import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Tokens live only in the Android Keystore-backed secure storage, never in
/// SharedPreferences or files (M9). Everything is wiped on logout.
class SecureStore {
  SecureStore([FlutterSecureStorage? storage]) : _s = storage ?? const FlutterSecureStorage();
  final FlutterSecureStorage _s;

  static const _access = 'access_token';
  static const _refresh = 'refresh_token';
  static const _safetySeen = 'safety_seen';
  static const _pushAsked = 'push_asked';

  Future<String?> get accessToken => _s.read(key: _access);
  Future<String?> get refreshToken => _s.read(key: _refresh);

  Future<void> saveTokens(String access, String refresh) async {
    await _s.write(key: _access, value: access);
    await _s.write(key: _refresh, value: refresh);
  }

  Future<bool> flag(String key) async => (await _s.read(key: key)) == '1';
  Future<void> setFlag(String key) => _s.write(key: key, value: '1');
  Future<bool> get safetySeen => flag(_safetySeen);
  Future<void> markSafetySeen() => setFlag(_safetySeen);
  Future<bool> get pushAsked => flag(_pushAsked);
  Future<void> markPushAsked() => setFlag(_pushAsked);

  Future<void> clear() => _s.deleteAll();
}
