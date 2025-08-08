package com.rnmediastore

import android.content.ContentValues
import android.content.Context
import android.content.ContentResolver
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import java.io.*

@ReactModule(name = RNMediaStoreModule.NAME)
class RNMediaStoreModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "RNMediaStore"
    }

    override fun getName(): String = NAME

    // Helper to build relative path for MediaStore (must end with '/')
    private fun buildRelativePath(directory: String?): String {
        val dir = (directory ?: "").trim().trimStart('/').trimEnd('/')
        return if (dir.isEmpty()) {
            "${Environment.DIRECTORY_DOWNLOADS}/"
        } else {
            "${Environment.DIRECTORY_DOWNLOADS}/$dir/"
        }
    }

    private fun findUriForFile(displayName: String, directory: String?): Uri? {
        val resolver = reactApplicationContext.contentResolver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val relPath = buildRelativePath(directory)
            val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?"
            val selectionArgs = arrayOf(displayName, relPath)
            val projection = arrayOf(MediaStore.MediaColumns._ID, MediaStore.MediaColumns.DISPLAY_NAME)
            resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, null).use { cursor ->
                if (cursor != null && cursor.moveToFirst()) {
                    val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                    return Uri.withAppendedPath(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id.toString())
                }
            }
        } else {
            // API < Q: search MediaStore for display name and path or check file existence
            val downloadsDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), directory ?: "")
            val targetFile = File(downloadsDir, displayName)
            if (targetFile.exists()) {
                // Get content URI via MediaStore query by _data (deprecated but works pre-Q)
                val selection = "${MediaStore.MediaColumns.DATA} = ?"
                val selectionArgs = arrayOf(targetFile.absolutePath)
                val projection = arrayOf(MediaStore.MediaColumns._ID)
                resolver.query(MediaStore.Files.getContentUri("external"), projection, selection, selectionArgs, null).use { cursor ->
                    if (cursor != null && cursor.moveToFirst()) {
                        val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                        val uri = Uri.withAppendedPath(MediaStore.Files.getContentUri("external"), id.toString())
                        return uri
                    }
                }
            }
        }
        return null
    }

    private fun insertToMediaStore(destinationFileName: String, directory: String?, mime: String? = null): Uri? {
        val resolver = reactApplicationContext.contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, destinationFileName)
            put(MediaStore.MediaColumns.MIME_TYPE, mime ?: "application/octet-stream")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.MediaColumns.RELATIVE_PATH, buildRelativePath(directory))
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
        }

        return try {
            resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
        } catch (ex: Exception) {
            null
        }
    }

    private fun finalizeMediaStoreUri(uri: Uri?, directory: String?) {
        if (uri == null) return
        val resolver = reactApplicationContext.contentResolver
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            try {
                resolver.update(uri, values, null, null)
            } catch (_: Exception) { /* best-effort */ }
        } else {
            // For older devices, trigger media scan so the file shows up in media providers
            try {
                val path = queryDataColumnForUri(uri)
                if (!path.isNullOrEmpty()) {
                    MediaScannerConnection.scanFile(reactApplicationContext, arrayOf(path), null, null)
                }
            } catch (_: Exception) { /* best-effort */ }
        }
    }

    private fun queryDataColumnForUri(uri: Uri): String? {
        val resolver = reactApplicationContext.contentResolver
        val projection = arrayOf(MediaStore.MediaColumns.DATA)
        resolver.query(uri, projection, null, null, null).use { cursor ->
            if (cursor != null && cursor.moveToFirst()) {
                val idx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA)
                return cursor.getString(idx)
            }
        }
        return null
    }

    @ReactMethod
    fun writeFile(fileName: String, directory: String?, base64Data: String, promise: Promise) {
        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val uri = insertToMediaStore(fileName, directory)
                if (uri == null) {
                    promise.reject("E_INSERT_FAILED", "Failed to create MediaStore entry for $fileName")
                    return
                }
                try {
                    reactApplicationContext.contentResolver.openOutputStream(uri).use { out ->
                        if (out == null) throw IOException("OutputStream is null")
                        out.write(bytes)
                        out.flush()
                    }
                    finalizeMediaStoreUri(uri, directory)
                    promise.resolve(uri.toString())
                } catch (ex: Exception) {
                    // Attempt to delete the created entry if write failed
                    try { reactApplicationContext.contentResolver.delete(uri, null, null) } catch (_: Exception) {}
                    promise.reject("E_WRITE_FAILED", "Failed to write file: ${ex.message}", ex)
                }
            } else {
                // Pre-Q: write to Downloads/<directory> and scan
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = if (directory.isNullOrBlank()) downloadsDir else File(downloadsDir, directory)
                if (!targetDir.exists()) {
                    if (!targetDir.mkdirs()) {
                        promise.reject("E_DIR_CREATE_FAILED", "Failed to create directory: ${targetDir.absolutePath}")
                        return
                    }
                }
                val targetFile = File(targetDir, fileName)
                FileOutputStream(targetFile).use { out ->
                    out.write(bytes)
                    out.flush()
                }
                MediaScannerConnection.scanFile(reactApplicationContext, arrayOf(targetFile.absolutePath), null) { _, _ -> }
                promise.resolve(targetFile.absolutePath)
            }
        } catch (ex: IllegalArgumentException) {
            promise.reject("E_INVALID_BASE64", "Invalid Base64 data: ${ex.message}", ex)
        } catch (ex: Exception) {
            promise.reject("E_WRITE_FAILED", "Failed to write file: ${ex.message}", ex)
        }
    }

    @ReactMethod
    fun readFile(fileName: String, directory: String?, promise: Promise) {
        try {
            val uri = findUriForFile(fileName, directory)
            if (uri == null) {
                // fallback: try file path on older devices
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val f = if (directory.isNullOrBlank()) File(downloadsDir, fileName) else File(File(downloadsDir, directory), fileName)
                    if (f.exists()) {
                        val bytes = f.inputStream().use { it.readBytes() }
                        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                        promise.resolve(base64)
                        return
                    }
                }
                promise.reject("E_NOT_FOUND", "File not found: $fileName in $directory")
                return
            }
            try {
                val bytes = reactApplicationContext.contentResolver.openInputStream(uri).use { it?.readBytes() }
                if (bytes == null) {
                    promise.reject("E_READ_FAILED", "Failed to read file: $fileName")
                    return
                }
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                promise.resolve(base64)
            } catch (ex: Exception) {
                promise.reject("E_READ_FAILED", "Failed to read file: ${ex.message}", ex)
            }
        } catch (ex: Exception) {
            promise.reject("E_READ_FAILED", "Failed to read file: ${ex.message}", ex)
        }
    }

    @ReactMethod
    fun deleteFile(fileName: String, directory: String?, promise: Promise) {
        try {
            val uri = findUriForFile(fileName, directory)
            if (uri != null) {
                try {
                    val deleted = reactApplicationContext.contentResolver.delete(uri, null, null)
                    if (deleted > 0) {
                        promise.resolve(true)
                    } else {
                        promise.reject("E_DELETE_FAILED", "MediaStore delete returned 0 for $fileName")
                    }
                } catch (ex: SecurityException) {
                    promise.reject("E_DELETE_SECURITY", "SecurityException while deleting: ${ex.message}", ex)
                } catch (ex: Exception) {
                    promise.reject("E_DELETE_FAILED", "Failed to delete file: ${ex.message}", ex)
                }
            } else {
                // fallback for pre-Q: try delete from file system
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val target = if (directory.isNullOrBlank()) File(downloadsDir, fileName) else File(File(downloadsDir, directory), fileName)
                    if (target.exists() && target.delete()) {
                        MediaScannerConnection.scanFile(reactApplicationContext, arrayOf(target.absolutePath), null) { _, _ -> }
                        promise.resolve(true)
                        return
                    }
                }
                promise.reject("E_NOT_FOUND", "File not found to delete: $fileName in $directory")
            }
        } catch (ex: Exception) {
            promise.reject("E_DELETE_FAILED", "Failed to delete file: ${ex.message}", ex)
        }
    }

    @ReactMethod
    fun listFiles(directory: String?, promise: Promise) {
        try {
            val resolver = reactApplicationContext.contentResolver
            val result = Arguments.createArray()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val relPath = buildRelativePath(directory)
                val selection = "${MediaStore.MediaColumns.RELATIVE_PATH} = ?"
                val selectionArgs = arrayOf(relPath)
                val projection = arrayOf(MediaStore.MediaColumns.DISPLAY_NAME)
                resolver.query(MediaStore.Downloads.EXTERNAL_CONTENT_URI, projection, selection, selectionArgs, null).use { cursor ->
                    if (cursor != null) {
                        val idx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                        while (cursor.moveToNext()) {
                            val name = cursor.getString(idx)
                            result.pushString(name)
                        }
                    }
                }
                promise.resolve(result)
            } else {
                // Pre-Q: list files from filesystem directory
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val dirFile = if (directory.isNullOrBlank()) downloadsDir else File(downloadsDir, directory)
                if (dirFile.exists() && dirFile.isDirectory) {
                    val files = dirFile.listFiles()
                    if (files != null) {
                        files.sortBy { it.name }
                        for (f in files) result.pushString(f.name)
                    }
                }
                promise.resolve(result)
            }
        } catch (ex: Exception) {
            promise.reject("E_LIST_FAILED", "Failed to list files: ${ex.message}", ex)
        }
    }

    /**
     * Copy a file from any supported source path (absolute file path or content:// URI)
     * to Downloads/<destDirectory>/<destFileName>. Returns the destination URI (string) or path (pre-Q).
     */
    @ReactMethod
    fun copyFile(sourcePath: String, destDirectory: String?, destFileName: String, promise: Promise) {
        var destUri: Uri? = null
        try {
            // Resolve input stream from sourcePath
            val inputStream: InputStream? = try {
                if (sourcePath.startsWith("content://")) {
                    reactApplicationContext.contentResolver.openInputStream(Uri.parse(sourcePath))
                } else {
                    // assume absolute file path
                    FileInputStream(File(sourcePath))
                }
            } catch (ex: FileNotFoundException) {
                null
            }

            if (inputStream == null) {
                promise.reject("E_SOURCE_NOT_FOUND", "Source not found or cannot open: $sourcePath")
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                destUri = insertToMediaStore(destFileName, destDirectory)
                if (destUri == null) {
                    inputStream.close()
                    promise.reject("E_INSERT_FAILED", "Failed to create destination entry for $destFileName")
                    return
                }
                try {
                    reactApplicationContext.contentResolver.openOutputStream(destUri).use { out ->
                        if (out == null) throw IOException("Destination OutputStream is null")
                        inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            var read: Int
                            while (input.read(buffer).also { read = it } != -1) {
                                out.write(buffer, 0, read)
                            }
                            out.flush()
                        }
                    }
                    finalizeMediaStoreUri(destUri, destDirectory)
                    promise.resolve(destUri.toString())
                } catch (ex: Exception) {
                    try { reactApplicationContext.contentResolver.delete(destUri, null, null) } catch (_: Exception) {}
                    promise.reject("E_COPY_FAILED", "Failed to copy to destination: ${ex.message}", ex)
                }
            } else {
                // Pre-Q: copy file to filesystem
                val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = if (destDirectory.isNullOrBlank()) downloadsDir else File(downloadsDir, destDirectory)
                if (!targetDir.exists()) {
                    if (!targetDir.mkdirs()) {
                        inputStream.close()
                        promise.reject("E_DIR_CREATE_FAILED", "Failed to create directory: ${targetDir.absolutePath}")
                        return
                    }
                }
                val outFile = File(targetDir, destFileName)
                FileOutputStream(outFile).use { out ->
                    inputStream.use { input ->
                        val buffer = ByteArray(8192)
                        var read: Int
                        while (input.read(buffer).also { read = it } != -1) {
                            out.write(buffer, 0, read)
                        }
                        out.flush()
                    }
                }
                MediaScannerConnection.scanFile(reactApplicationContext, arrayOf(outFile.absolutePath), null) { _, _ -> }
                promise.resolve(outFile.absolutePath)
            }
        } catch (ex: SecurityException) {
            promise.reject("E_COPY_SECURITY", "SecurityException while copying: ${ex.message}", ex)
        } catch (ex: Exception) {
            // Try to cleanup destUri if created
            try { if (destUri != null) reactApplicationContext.contentResolver.delete(destUri, null, null) } catch (_: Exception) {}
            promise.reject("E_COPY_FAILED", "Failed to copy file: ${ex.message}", ex)
        }
    }

    /**
     * Move = Copy then delete original (best-effort).
     */
    @ReactMethod
    fun moveFile(sourcePath: String, destDirectory: String?, destFileName: String, promise: Promise) {
        try {
            // First copy the file
            val inputStream = if (sourcePath.startsWith("content://")) {
                val sourceUri = Uri.parse(sourcePath)
                reactApplicationContext.contentResolver.openInputStream(sourceUri)
            } else {
                File(sourcePath).inputStream()
            }

            if (inputStream == null) {
                promise.reject("E_SOURCE_NOT_FOUND", "Source not found or cannot open: $sourcePath")
                return
            }

            var destUri: Uri? = null
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // Q+: use MediaStore
                    destUri = insertToMediaStore(destFileName, destDirectory)
                    if (destUri == null) {
                        inputStream.close()
                        promise.reject("E_INSERT_FAILED", "Failed to create destination entry for $destFileName")
                        return
                    }

                    reactApplicationContext.contentResolver.openOutputStream(destUri)?.use { out ->
                        inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            var read: Int
                            while (input.read(buffer).also { read = it } != -1) {
                                out.write(buffer, 0, read)
                            }
                            out.flush()
                        }
                    }
                    finalizeMediaStoreUri(destUri, destDirectory)
                    
                    // After successful copy, attempt to delete source
                    try {
                        if (sourcePath.startsWith("content://")) {
                            val sourceUri = Uri.parse(sourcePath)
                            reactApplicationContext.contentResolver.delete(sourceUri, null, null)
                        } else {
                            val f = File(sourcePath)
                            if (f.exists()) {
                                f.delete()
                            }
                        }
                    } catch (_: Exception) { /* ignore deletion errors */ }
                    
                    promise.resolve(destUri.toString())
                } else {
                    // Pre-Q: copy file to filesystem
                    val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                    val targetDir = if (destDirectory.isNullOrBlank()) downloadsDir else File(downloadsDir, destDirectory)
                    if (!targetDir.exists()) {
                        if (!targetDir.mkdirs()) {
                            inputStream.close()
                            promise.reject("E_DIR_CREATE_FAILED", "Failed to create directory: ${targetDir.absolutePath}")
                            return
                        }
                    }
                    val outFile = File(targetDir, destFileName)
                    FileOutputStream(outFile).use { out ->
                        inputStream.use { input ->
                            val buffer = ByteArray(8192)
                            var read: Int
                            while (input.read(buffer).also { read = it } != -1) {
                                out.write(buffer, 0, read)
                            }
                            out.flush()
                        }
                    }
                    MediaScannerConnection.scanFile(reactApplicationContext, arrayOf(outFile.absolutePath), null) { _, _ -> }
                    
                    // After successful copy, attempt to delete source
                    try {
                        val f = File(sourcePath)
                        if (f.exists()) {
                            f.delete()
                        }
                    } catch (_: Exception) { /* ignore deletion errors */ }
                    
                    promise.resolve(outFile.absolutePath)
                }
            } catch (ex: SecurityException) {
                try { if (destUri != null) reactApplicationContext.contentResolver.delete(destUri, null, null) } catch (_: Exception) {}
                promise.reject("E_COPY_SECURITY", "SecurityException while copying: ${ex.message}", ex)
            } catch (ex: Exception) {
                try { if (destUri != null) reactApplicationContext.contentResolver.delete(destUri, null, null) } catch (_: Exception) {}
                promise.reject("E_COPY_FAILED", "Failed to copy file: ${ex.message}", ex)
            }
        } catch (ex: Exception) {
            promise.reject("E_MOVE_FAILED", "Failed to move file: ${ex.message}", ex)
        }
    }
}
