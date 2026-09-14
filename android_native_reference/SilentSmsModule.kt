// OPT-IN reference module. Not wired up by default — see the note in
// src/services/alertService.ts for why the default JS path always ends in a
// user tap on the native SMS composer instead of sending silently.
//
// If you have made a deliberate, consent-covered decision to auto-send
// emergency SMS without a final tap (Android only — iOS does not permit
// this), this module shows the native side of that path using SmsManager.
// It requires the SEND_SMS permission (see src/sensors/permissions.ts,
// key: 'sms') and should only ever be invoked from the CRITICAL branch of
// the triage engine, never speculatively.
//
// package: com.veritahealth (adjust to your app id)

package com.veritahealth

import android.telephony.SmsManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray

class SilentSmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "SilentSms"

    @ReactMethod
    fun sendToAll(phoneNumbers: ReadableArray, message: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            for (i in 0 until phoneNumbers.size()) {
                val number = phoneNumbers.getString(i) ?: continue
                val parts = smsManager.divideMessage(message)
                smsManager.sendMultipartTextMessage(number, null, parts, null, null)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SILENT_SMS_FAILED", e)
        }
    }
}

// Register in your ReactPackage's createNativeModules(), then from JS:
//
//   import { NativeModules } from 'react-native';
//   await NativeModules.SilentSms.sendToAll(contacts.map(c => c.phone), message);
