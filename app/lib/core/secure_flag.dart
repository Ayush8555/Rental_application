import 'package:flutter/services.dart';

/// Turns Android FLAG_SECURE on for screens that show payment proof (M6).
class SecureFlag {
  static const _c = MethodChannel('in.rentnook.app/device');
  static Future<void> on() async {
    try {
      await _c.invokeMethod<void>('secureOn');
    } catch (_) {}
  }

  static Future<void> off() async {
    try {
      await _c.invokeMethod<void>('secureOff');
    } catch (_) {}
  }
}
