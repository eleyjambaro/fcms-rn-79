package com.rndeviceid

import android.provider.Settings
import com.facebook.react.bridge.*

class RNDeviceIdModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RNDeviceId"

    @ReactMethod
    fun getAndroidId(promise: Promise) {
        try {
            val androidId = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ANDROID_ID
            )
            promise.resolve(androidId)
        } catch (e: Exception) {
            promise.reject("GET_ANDROID_ID_ERROR", e.message, e)
        }
    }
}
