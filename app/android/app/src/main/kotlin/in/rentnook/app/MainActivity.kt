package `in`.rentnook.app

import android.annotation.SuppressLint
import android.provider.Settings
import android.view.WindowManager
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.rentnook.app/device").setMethodCallHandler { call, result ->
            when (call.method) {
                // Per app-signing-key id; survives reinstalls. Used only to stop
                // free offers being claimed again, never for tracking.
                "androidId" -> result.success(androidId())
                // Payment proof screen: block screenshots and screen recording.
                "secureOn" -> { window.addFlags(WindowManager.LayoutParams.FLAG_SECURE); result.success(null) }
                "secureOff" -> { window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE); result.success(null) }
                else -> result.notImplemented()
            }
        }
    }

    @SuppressLint("HardwareIds")
    private fun androidId(): String? = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
}
