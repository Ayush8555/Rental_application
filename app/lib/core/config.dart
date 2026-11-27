/// Build-time configuration, passed with --dart-define (see app/README).
/// Nothing secret lives here: the Firebase values are public client config,
/// locked to the app's package name and signing certificate in Google Cloud.
abstract final class Config {
  static const flavor = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
  static const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');
  static const webUrl = String.fromEnvironment('WEB_URL', defaultValue: 'http://10.0.2.2:4000');
  static const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '1.0.0');
  static const playStoreUrl = 'https://play.google.com/store/apps/details?id=in.rentnook.app';

  static const firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');

  /// Without Firebase values the app runs against a backend in AUTH_PROVIDER=dev
  /// mode, where any 6-digit code signs in. Release builds refuse this.
  static bool get hasFirebase => firebaseApiKey.isNotEmpty && firebaseAppId.isNotEmpty;
}
