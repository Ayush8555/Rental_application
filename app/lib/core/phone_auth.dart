import 'dart:async';

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'config.dart';

enum OtpError { invalidNumber, tooMany, network, wrongCode, expired, unknown }

class OtpException implements Exception {
  OtpException(this.error);
  final OtpError error;
}

/// Phone OTP. Firebase in staging/production; a local stand-in when the build
/// has no Firebase config (dev only, the backend refuses it elsewhere).
abstract class PhoneAuth {
  /// Starts verification; returns an opaque id for [confirm]. May complete
  /// on its own on Android (SMS auto-read), in which case [onAutoToken] fires.
  Future<String> sendCode(String e164, {void Function(String idToken)? onAutoToken});
  Future<String> confirm(String verificationId, String code);
  Future<void> signOut();

  static PhoneAuth create() => Config.hasFirebase ? FirebasePhoneAuth() : DevPhoneAuth();
}

class FirebasePhoneAuth implements PhoneAuth {
  final _auth = FirebaseAuth.instance;

  @override
  Future<String> sendCode(String e164, {void Function(String idToken)? onAutoToken}) {
    final done = Completer<String>();
    _auth.verifyPhoneNumber(
      phoneNumber: e164,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (cred) async {
        try {
          final r = await _auth.signInWithCredential(cred);
          final t = await r.user?.getIdToken(true);
          if (t != null) onAutoToken?.call(t);
        } catch (_) {}
      },
      verificationFailed: (e) {
        if (done.isCompleted) return;
        final code = e.code;
        done.completeError(OtpException(code == 'invalid-phone-number'
            ? OtpError.invalidNumber
            : code == 'too-many-requests' || code == 'quota-exceeded'
                ? OtpError.tooMany
                : code == 'network-request-failed'
                    ? OtpError.network
                    : OtpError.unknown));
      },
      codeSent: (id, _) => done.isCompleted ? null : done.complete(id),
      codeAutoRetrievalTimeout: (_) {},
    );
    return done.future;
  }

  @override
  Future<String> confirm(String verificationId, String code) async {
    try {
      final cred = PhoneAuthProvider.credential(verificationId: verificationId, smsCode: code);
      final r = await _auth.signInWithCredential(cred);
      final token = await r.user?.getIdToken(true);
      if (token == null) throw OtpException(OtpError.unknown);
      return token;
    } on FirebaseAuthException catch (e) {
      throw OtpException(e.code == 'invalid-verification-code'
          ? OtpError.wrongCode
          : e.code == 'session-expired'
              ? OtpError.expired
              : e.code == 'network-request-failed'
                  ? OtpError.network
                  : OtpError.unknown);
    }
  }

  @override
  Future<void> signOut() => _auth.signOut();
}

class DevPhoneAuth implements PhoneAuth {
  @override
  Future<String> sendCode(String e164, {void Function(String idToken)? onAutoToken}) async => e164;

  @override
  Future<String> confirm(String verificationId, String code) async {
    if (!RegExp(r'^\d{6}$').hasMatch(code)) throw OtpException(OtpError.wrongCode);
    return 'dev:$verificationId';
  }

  @override
  Future<void> signOut() async {}
}

/// App Check token for the backend's sensitive endpoints (login, contact,
/// payments). Play Integrity in release builds.
class AppCheckTokens {
  static Future<String?> get() async {
    if (!Config.hasFirebase) return 'dev-app-check';
    try {
      return await FirebaseAppCheck.instance.getToken();
    } catch (_) {
      return null;
    }
  }
}
