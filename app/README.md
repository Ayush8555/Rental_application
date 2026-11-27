# RentNook app (Flutter)

Android first. iOS builds from the same code later.

## Run against a local API

```bash
flutter pub get
flutter run --flavor dev --dart-define=API_URL=http://10.0.2.2:4000
```

With no Firebase values the app signs in through the backend's dev mode:
any 10-digit number, any 6-digit code. The backend must run with
`AUTH_PROVIDER=dev`, which it refuses outside development.

## Staging / production builds

```bash
flutter build appbundle --release --flavor prod \
  --obfuscate --split-debug-info=build/symbols \
  --dart-define=FLAVOR=prod \
  --dart-define=API_URL=https://api.rentnook.in \
  --dart-define=WEB_URL=https://www.rentnook.in \
  --dart-define=APP_VERSION=1.0.0 \
  --dart-define=FIREBASE_API_KEY=... \
  --dart-define=FIREBASE_APP_ID=... \
  --dart-define=FIREBASE_SENDER_ID=... \
  --dart-define=FIREBASE_PROJECT_ID=rentnook-prod
```

The Firebase values are public client config. Lock the API key to the
package name and SHA-256 of the upload and Play signing keys in Google Cloud.
A release build without them stops at start-up on purpose.

Signing: put `android/key.properties` (storeFile, storePassword, keyAlias,
keyPassword) next to the upload keystore. Both are git-ignored; the originals
live in the company password manager.

## Where things are

- `lib/theme/tokens.dart` — colours, spacing, type. Screens use only these.
- `lib/theme/icons.dart` — the Phosphor icons we use (font in `assets/fonts`).
- `lib/l10n/app_en.arb`, `app_hi.arb` — every string, English and Hindi.
- `lib/data/repo.dart` — every API call.
- `lib/screens/` — onboarding, browse, lister, money, account.
- `android/app/src/main/kotlin/.../MainActivity.kt` — device id and FLAG_SECURE.

`/gallery` (debug builds only) shows every core component for UI review.

## Checks

```bash
flutter analyze
flutter test
```
