package com.rnmediastore

import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.os.Environment
import android.provider.MediaStore
import android.util.Log

import com.facebook.react.bridge.*

import java.io.*

class RNMediaStoreModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "RNMediaStore"
    }

    override fun getConstants(): Map<String, Any> {
        return mapOf(
            "DirectoryPath" to mapOf(
                "Downloads" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath,
                "Documents" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS).absolutePath,
                "Pictures" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES).absolutePath,
                "Movies" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MOVIES).absolutePath,
                "Music" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC).absolutePath,
                "DCIM" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM).absolutePath,
                "Screenshots" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES).absolutePath + "/Screenshots"
            )
        )
    }

    private fun getCollectionUri(directory: String?): Uri {
        val dir = directory ?: Environment.DIRECTORY_DOWNLOADS
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        } else {
            MediaStore.Files.getContentUri("external")
        }
    }

    @ReactMethod
    fun writeFile(fileName: String, content: String, mimeType: String, directory: String?, promise: Promise) {
        try {
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(MediaStore.MediaColumns.RELATIVE_PATH, directory ?: Environment.DIRECTORY_DOWNLOADS)
            }

            val uri = reactContext.contentResolver.insert(getCollectionUri(directory), values)
                ?: throw IOException("Failed to create MediaStore entry")

            reactContext.contentResolver.openOutputStream(uri)?.use {
                it.write(content.toByteArray())
            } ?: throw IOException("Failed to open output stream")

            promise.resolve(uri.toString())
        } catch (e: Exception) {
            Log.e("RNMediaStore", "writeFile failed", e)
            promise.reject("WRITE_FILE_ERROR", e)
        }
    }

    @ReactMethod
    fun readFile(fileName: String, directory: String?, promise: Promise) {
        try {
            val collection = getCollectionUri(directory)
            val relativePath = (directory ?: Environment.DIRECTORY_DOWNLOADS).let {
                if (it.endsWith("/")) it else "$it/"
            }

            val selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?"
            val selectionArgs = arrayOf(fileName, "%$relativePath%")

            val cursor = reactContext.contentResolver.query(collection, null, selection, selectionArgs, null)
            cursor?.use {
                if (it.moveToFirst()) {
                    val id = it.getInt(it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                    val uri = Uri.withAppendedPath(collection, id.toString())
                    val inputStream = reactContext.contentResolver.openInputStream(uri)
                    val reader = BufferedReader(InputStreamReader(inputStream))
                    val content = reader.readText()
                    reader.close()
                    promise.resolve(content)
                    return
                }
            }
            throw FileNotFoundException("File not found: $fileName in $relativePath")
        } catch (e: Exception) {
            Log.e("RNMediaStore", "readFile failed", e)
            promise.reject("READ_FILE_ERROR", e)
        }
    }

    @ReactMethod
    fun deleteFile(fileName: String, directory: String?, promise: Promise) {
        try {
            val uri = queryFileUri(fileName, directory) ?: throw FileNotFoundException("File not found: $fileName")
            val deleted = reactContext.contentResolver.delete(uri, null, null)
            promise.resolve(deleted > 0)
        } catch (e: Exception) {
            Log.e("RNMediaStore", "deleteFile failed", e)
            promise.reject("DELETE_FILE_ERROR", e)
        }
    }

    @ReactMethod
    fun readDirectory(directory: String?, promise: Promise) {
        try {
            val collection = getCollectionUri(directory)
            val projection = arrayOf(
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.SIZE,
                MediaStore.MediaColumns.MIME_TYPE,
                MediaStore.MediaColumns.DATE_ADDED
            )

            val cursor = reactContext.contentResolver.query(
                collection,
                projection,
                MediaStore.MediaColumns.RELATIVE_PATH + "=?",
                arrayOf((directory ?: Environment.DIRECTORY_DOWNLOADS) + "/"),
                MediaStore.MediaColumns.DATE_ADDED + " DESC"
            )

            val fileList = Arguments.createArray()
            cursor?.use {
                while (it.moveToNext()) {
                    val fileMap = Arguments.createMap()
                    fileMap.putString("name", it.getString(0))
                    fileMap.putDouble("size", it.getLong(1).toDouble())
                    fileMap.putString("mimeType", it.getString(2))
                    fileMap.putDouble("dateAdded", it.getLong(3).toDouble())
                    fileList.pushMap(fileMap)
                }
            }
            promise.resolve(fileList)
        } catch (e: Exception) {
            Log.e("RNMediaStore", "readDirectory failed", e)
            promise.reject("READ_DIRECTORY_ERROR", e)
        }
    }

    private fun queryFileUri(fileName: String, directory: String?): Uri? {
        val collection = getCollectionUri(directory)
        val relativePath = (directory ?: Environment.DIRECTORY_DOWNLOADS).let {
            if (it.endsWith("/")) it else "$it/"
        }
        val selection = MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " + MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?"
        val selectionArgs = arrayOf(fileName, "%$relativePath%")

        val cursor = reactContext.contentResolver.query(collection, null, selection, selectionArgs, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val id = it.getInt(it.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
                return Uri.withAppendedPath(collection, id.toString())
            }
        }
        return null
    }

    @ReactMethod
    fun deleteDirectory(directory: String, promise: Promise) {
        try {
            val collection = getCollectionUri(directory)
            val selection = MediaStore.MediaColumns.RELATIVE_PATH + "=?"
            val selectionArgs = arrayOf("$directory/")

            val deletedCount = reactContext.contentResolver.delete(collection, selection, selectionArgs)
            promise.resolve(deletedCount)
        } catch (e: Exception) {
            Log.e("RNMediaStore", "deleteDirectory failed", e)
            promise.reject("DELETE_DIRECTORY_ERROR", e)
        }
    }

    @ReactMethod
    fun copyFileToMediaStore(sourcePath: String, fileName: String, mimeType: String, destinationPath: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists() || !sourceFile.isFile) {
                throw FileNotFoundException("Source file not found: $sourcePath")
            }

            val relativePath = destinationPath.takeIf { it.isNotEmpty() } ?: Environment.DIRECTORY_DOWNLOADS

            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            }

            val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
            } else {
                MediaStore.Files.getContentUri("external")
            }

            val resolver = reactContext.contentResolver
            val uri = resolver.insert(collection, values)
                ?: throw IOException("Failed to create MediaStore entry")

            resolver.openOutputStream(uri)?.use { outputStream ->
                FileInputStream(sourceFile).use { inputStream ->
                    inputStream.copyTo(outputStream)
                }
            } ?: throw IOException("Failed to open output stream")

            promise.resolve(uri.toString())
        } catch (e: Exception) {
            Log.e("RNMediaStore", "copyFileToMediaStore failed", e)
            promise.reject("COPY_FILE_ERROR", e)
        }
    }

    @ReactMethod
    fun copyFileFromMediaStore(documentUriString: String, destinationPath: String, promise: Promise) {
        try {
            val uri = Uri.parse(documentUriString)
            val resolver: ContentResolver = reactContext.contentResolver

            val fileName = resolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (cursor.moveToFirst() && nameIndex != -1) {
                    cursor.getString(nameIndex)
                } else {
                    null
                }
            } ?: run {
                promise.reject("InvalidUri", "Unable to determine file name from URI: $documentUriString")
                return
            }

            val destFile = File(destinationPath, fileName)
            destFile.parentFile?.mkdirs()

            resolver.openInputStream(uri)?.use { inputStream ->
                FileOutputStream(destFile).use { outputStream ->
                    val buffer = ByteArray(4096)
                    var bytesRead: Int
                    while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                        outputStream.write(buffer, 0, bytesRead)
                    }
                    outputStream.flush()
                }
                promise.resolve(true)
            } ?: run {
                promise.reject("FileNotFound", "Unable to open input stream from URI: $documentUriString")
            }

        } catch (e: Exception) {
            Log.e("RNMediaStore", "copyFileFromMediaStore error", e)
            promise.reject("CopyError", e.localizedMessage)
        }
    }
}
