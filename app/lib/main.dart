import 'dart:async';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/config.dart';
import 'l10n/app_localizations.dart';
import 'router.dart';
import 'state/app_state.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (Config.hasFirebase) {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: Config.firebaseApiKey,
        appId: Config.firebaseAppId,
        messagingSenderId: Config.firebaseSenderId,
        projectId: Config.firebaseProjectId,
      ),
    );
    await FirebaseAppCheck.instance.activate(
      providerAndroid: kReleaseMode ? const AndroidPlayIntegrityProvider() : const AndroidDebugProvider(),
    );
  } else if (kReleaseMode) {
    // A release build without Firebase would silently use dev login.
    throw StateError('Release builds need the Firebase --dart-define values');
  }
  runApp(const ProviderScope(child: RentNookApp()));
}

class RentNookApp extends ConsumerStatefulWidget {
  const RentNookApp({super.key});
  @override
  ConsumerState<RentNookApp> createState() => _AppState();
}

class _AppState extends ConsumerState<RentNookApp> {
  late final GoRouter _router = buildRouter(ref);

  @override
  Widget build(BuildContext context) {
    final hindi = ref.watch(hindiProvider);
    ref.listen(sessionProvider, (prev, next) {
      // Session ended (refresh failed, blocked, logged out elsewhere).
      if (prev?.signedIn == true && !next.signedIn) _router.go('/welcome');
    });
    return MaterialApp.router(
      title: 'RentNook',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: _router,
      locale: Locale(hindi ? 'hi' : 'en'),
      supportedLocales: L.supportedLocales,
      localizationsDelegates: const [L.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      builder: (context, child) {
        // Respect the phone's font size, but cap at 130% so layouts hold (section 8).
        final mq = MediaQuery.of(context);
        return MediaQuery(data: mq.copyWith(textScaler: mq.textScaler.clamp(maxScaleFactor: 1.3)), child: child!);
      },
    );
  }
}
