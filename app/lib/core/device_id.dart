import 'package:flutter/services.dart';

/// Android's per-app device id (Settings.Secure.ANDROID_ID). It stays the same
/// across reinstalls of the same signed app, so free trials cannot be taken
/// again by reinstalling. Read through a tiny channel in MainActivity.kt.
class DeviceId {
  static const _channel = MethodChannel('in.rentnook.app/device');
  static String? _cached;

  static Future<String> get() async {
    if (_cached != null) return _cached!;
    try {
      final id = await _channel.invokeMethod<String>('androidId');
      if (id != null && RegExp(r'^[A-Za-z0-9_-]{8,128}$').hasMatch(id)) return _cached = 'a-$id';
    } catch (_) {}
    return _cached = 'unknown-device';
  }
}
