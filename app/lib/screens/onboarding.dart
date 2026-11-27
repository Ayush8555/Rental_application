import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/icons.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../core/phone_auth.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/common.dart';

// ---------------------------------------------------------------- A-01 Splash and Welcome

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});
  @override
  ConsumerState<SplashScreen> createState() => _SplashState();
}

class _SplashState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_start());
  }

  Future<void> _start() async {
    // Session check reads tokens only from secure storage; capped at 1.5 s.
    final restore = ref.read(sessionProvider.notifier).restore();
    final settings = ref.read(settingsProvider.future).timeout(const Duration(milliseconds: 1500)).then<PublicSettings?>((s) => s).catchError((_) => null);
    await Future.any([Future.wait([restore, settings]), Future<void>.delayed(const Duration(milliseconds: 1500))]);
    if (!mounted) return;
    final s = await settings;
    if (!mounted) return;
    if (s != null && versionBelow(Config.appVersion, s.minAppVersion)) return context.go('/update');
    final session = ref.read(sessionProvider);
    if (session.signedIn) {
      if (session.me?.needsProfile ?? false) return context.go('/profile-setup');
      return context.go('/home');
    }
    context.go('/welcome');
  }

  @override
  Widget build(BuildContext context) => const Scaffold(
        backgroundColor: C.primary,
        body: Center(child: _Logo(size: 72, onTeal: true)),
      );
}

class _Logo extends StatelessWidget {
  const _Logo({this.size = 48, this.onTeal = false});
  final double size;
  final bool onTeal;
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: onTeal ? C.surface : C.primary, borderRadius: BorderRadius.circular(size * 0.22)),
        alignment: Alignment.center,
        child: Text('R', style: TextStyle(fontFamily: T.head, fontWeight: FontWeight.w700, fontSize: size * 0.56, color: onTeal ? C.primary : C.surface, height: 1)),
      );
}

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    Widget benefit(IconData i, String t) => Padding(
          padding: const EdgeInsets.only(bottom: S.s4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.input)),
              child: Icon(i, color: C.primary, size: 22),
            ),
            const SizedBox(width: S.s3),
            Expanded(child: Padding(padding: const EdgeInsets.only(top: S.s2), child: Text(t, style: T.body15))),
          ]),
        );
    return Scaffold(
      backgroundColor: C.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(S.screen),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const _Logo(size: 36),
              const Spacer(),
              _LangSwitch(),
            ]),
            const Spacer(),
            Text(l.appName, style: T.h1.copyWith(fontSize: 28)),
            const SizedBox(height: S.s1),
            Text(l.tagline, style: T.h3.copyWith(color: C.ink2, fontWeight: FontWeight.w400)),
            const SizedBox(height: S.s8),
            benefit(PhosphorIconsRegular.magnifyingGlass, l.benefitFind),
            benefit(PhosphorIconsRegular.whatsappLogo, l.benefitChat),
            benefit(PhosphorIconsRegular.currencyInr, l.benefitEarn),
            const Spacer(),
            Btn(l.continueWithMobile, onPressed: () => context.push('/login')),
            const SizedBox(height: S.s2),
            Btn(l.justBrowse, kind: BtnKind.text, full: true, onPressed: () => context.go('/choose-city?guest=1')),
          ]),
        ),
      ),
    );
  }
}

class _LangSwitch extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hindi = ref.watch(hindiProvider);
    return TextButton(
      onPressed: () => ref.read(sessionProvider.notifier).setGuestLanguage(hindi ? 'en' : 'hi'),
      child: Text(hindi ? 'English' : 'हिंदी', style: T.strong.copyWith(color: C.primary)),
    );
  }
}

// ---------------------------------------------------------------- force update

class ForceUpdateScreen extends StatelessWidget {
  const ForceUpdateScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Scaffold(
      backgroundColor: C.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(S.screen),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Spacer(),
            const Icon(PhosphorIconsRegular.arrowCircleUp, size: 48, color: C.primary),
            const SizedBox(height: S.s4),
            Text(l.updateTitle, style: T.h1),
            const SizedBox(height: S.s2),
            Text(l.updateBody, style: T.body15.copyWith(color: C.ink2)),
            const Spacer(),
            Btn(l.updateButton, onPressed: () => launchUrl(Uri.parse(Config.playStoreUrl), mode: LaunchMode.externalApplication)),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-02 Sign in — mobile number

class PhoneScreen extends ConsumerStatefulWidget {
  const PhoneScreen({super.key, this.next});
  final String? next;
  @override
  ConsumerState<PhoneScreen> createState() => _PhoneState();
}

class _PhoneState extends ConsumerState<PhoneScreen> {
  final _ctrl = TextEditingController();
  bool _consent = false;
  bool _sending = false;
  String? _error;

  bool get _valid => RegExp(r'^[6-9]\d{9}$').hasMatch(_ctrl.text);

  Future<void> _send() async {
    final l = L.of(context);
    if (!_valid) return setState(() => _error = l.invalidMobile);
    setState(() {
      _sending = true;
      _error = null;
    });
    final number = _ctrl.text;
    try {
      final auth = ref.read(phoneAuthProvider);
      final id = await auth.sendCode('+91$number', onAutoToken: (token) => _autoSignIn(token));
      if (!mounted) return;
      await context.push('/otp', extra: OtpArgs(number, id, widget.next));
    } on OtpException catch (e) {
      setState(() => _error = switch (e.error) {
            OtpError.invalidNumber => l.invalidMobile,
            OtpError.tooMany => l.tooManyAttempts,
            OtpError.network => l.networkError,
            _ => l.somethingWrong,
          });
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _autoSignIn(String token) async {
    if (!mounted) return;
    await finishSignIn(context, ref, token, widget.next);
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final settings = ref.watch(settingsProvider).value;
    TapGestureRecognizer link(String? url) => TapGestureRecognizer()..onTap = () => url == null ? null : launchUrl(Uri.parse(url));
    return Scaffold(
      appBar: AppBar(),
      backgroundColor: C.surface,
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(S.screen), children: [
          Text(l.enterMobileTitle, style: T.h1),
          const SizedBox(height: S.s5),
          TextField(
            controller: _ctrl,
            autofocus: true,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: T.h3.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
            onChanged: (_) => setState(() => _error = null),
            decoration: InputDecoration(
              prefixIcon: Padding(padding: const EdgeInsets.fromLTRB(S.s3, 0, S.s2, 0), child: Center(widthFactor: 1, child: Text('+91', style: T.h3.copyWith(color: C.ink2)))),
              hintText: l.mobileHint,
              counterText: '',
              errorText: _error,
            ),
          ),
          const SizedBox(height: S.s3),
          InkWell(
            onTap: () => setState(() => _consent = !_consent),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Checkbox(value: _consent, onChanged: (v) => setState(() => _consent = v ?? false)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: S.s3),
                  child: Text.rich(TextSpan(style: T.secondary.copyWith(color: C.ink), children: [
                    TextSpan(text: l.ageConsentPrefix),
                    TextSpan(text: l.terms, style: const TextStyle(color: C.primary, decoration: TextDecoration.underline), recognizer: link(settings?.termsUrl)),
                    TextSpan(text: l.and),
                    TextSpan(text: l.privacyPolicy, style: const TextStyle(color: C.primary, decoration: TextDecoration.underline), recognizer: link(settings?.privacyUrl)),
                    TextSpan(text: ' ${l.ageConsentSuffix}'),
                  ])),
                ),
              ),
            ]),
          ),
          const SizedBox(height: S.s5),
          Btn(l.sendOtp, loading: _sending, onPressed: _valid && _consent ? _send : null),
          const SizedBox(height: S.s3),
          Row(children: [
            const Icon(PhosphorIconsRegular.lockSimple, size: 16, color: C.ink2),
            const SizedBox(width: S.s2),
            Expanded(child: Text(l.numberNeverShown, style: T.secondary)),
          ]),
        ]),
      ),
    );
  }
}

class OtpArgs {
  OtpArgs(this.number, this.verificationId, this.next);
  final String number, verificationId;
  final String? next;
}

/// After the server accepts the Firebase token: profile setup for new
/// people, otherwise back to where they came from.
Future<void> finishSignIn(BuildContext context, WidgetRef ref, String idToken, String? next) async {
  final settings = await ref.read(settingsProvider.future).catchError((_) => ref.read(settingsProvider).requireValue);
  final needsProfile = await ref.read(sessionProvider.notifier).signIn(idToken, consentVersion: settings.privacyVersion);
  if (!context.mounted) return;
  if (needsProfile) {
    context.go(next == null ? '/profile-setup' : '/profile-setup?next=${Uri.encodeComponent(next)}');
  } else {
    context.go(next ?? '/home');
  }
}

// ---------------------------------------------------------------- A-03 Sign in — OTP

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.args});
  final OtpArgs args;
  @override
  ConsumerState<OtpScreen> createState() => _OtpState();
}

class _OtpState extends ConsumerState<OtpScreen> {
  final _ctrl = TextEditingController();
  late String _verificationId = widget.args.verificationId;
  int _seconds = 30;
  int _wrong = 0;
  Timer? _timer;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tick();
  }

  void _tick() {
    _timer?.cancel();
    _seconds = 30;
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_seconds <= 1) t.cancel();
      if (mounted) setState(() => _seconds--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final l = L.of(context);
    if (_ctrl.text.length != 6 || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await ref.read(phoneAuthProvider).confirm(_verificationId, _ctrl.text);
      if (!mounted) return;
      await finishSignIn(context, ref, token, widget.args.next);
    } on OtpException catch (e) {
      _wrong++;
      _ctrl.clear();
      setState(() => _error = _wrong >= 5
          ? l.tooManyAttempts
          : switch (e.error) {
              OtpError.wrongCode => l.wrongCode,
              OtpError.expired => l.codeExpired,
              OtpError.network => l.networkError,
              _ => l.somethingWrong,
            });
      unawaited(HapticFeedback.mediumImpact());
    } on ApiException catch (e) {
      setState(() => _error = e.kind == ApiErrorKind.blocked || e.code == 'ACCOUNT_BLOCKED' ? l.accountBlocked : errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      _verificationId = await ref.read(phoneAuthProvider).sendCode('+91${widget.args.number}');
      _tick();
    } catch (_) {
      if (mounted) setState(() => _error = L.of(context).tooManyAttempts);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final n = widget.args.number;
    final masked = '${n.substring(0, 2)}XXXXXX${n.substring(8)}';
    final locked = _wrong >= 5;
    return Scaffold(
      appBar: AppBar(),
      backgroundColor: C.surface,
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(S.screen), children: [
          Text(l.otpTitle, style: T.h1),
          const SizedBox(height: S.s1),
          Text(l.otpSentTo(masked), style: T.body15.copyWith(color: C.ink2)),
          const SizedBox(height: S.s5),
          TextField(
            controller: _ctrl,
            autofocus: true,
            enabled: !locked,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            maxLength: 6,
            textAlign: TextAlign.center,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            style: T.h1.copyWith(letterSpacing: 12, fontFeatures: const [FontFeature.tabularFigures()]),
            decoration: InputDecoration(counterText: '', errorText: _error, hintText: '······'),
            onChanged: (v) {
              setState(() => _error = null);
              if (v.length == 6) unawaited(_verify());
            },
          ),
          const SizedBox(height: S.s3),
          Row(children: [
            _seconds > 0 ? Text(l.resendIn(_seconds), style: T.secondary) : TextButton(onPressed: locked ? null : _resend, child: Text(l.resendCode)),
            const Spacer(),
            TextButton(onPressed: () => context.pop(), child: Text(l.changeNumber)),
          ]),
          const SizedBox(height: S.s4),
          Btn(l.verify, loading: _busy, onPressed: _ctrl.text.length == 6 && !locked ? _verify : null),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-04 Profile setup

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key, this.next, this.editing = false});
  final String? next;
  final bool editing;
  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupState();
}

final _nameRe = RegExp(r"^[\p{L}\p{M}][\p{L}\p{M} .']{1,39}$", unicode: true);

class _ProfileSetupState extends ConsumerState<ProfileSetupScreen> {
  late final _name = TextEditingController(text: ref.read(sessionProvider).me?.name ?? '');
  City? _city;
  bool _busy = false;
  String? _nameError, _error;

  @override
  void initState() {
    super.initState();
    _city = ref.read(sessionProvider).me?.city;
  }

  Future<void> _save() async {
    final l = L.of(context);
    final name = _name.text.trim();
    if (!_nameRe.hasMatch(name)) return setState(() => _nameError = l.nameInvalid);
    if (_city == null) return;
    setState(() => _busy = true);
    try {
      final me = await ref.read(repoProvider).updateMe(name: name, cityId: _city!.id, language: ref.read(sessionProvider).guestLanguage == 'hi' && !widget.editing ? 'hi' : null);
      ref.read(sessionProvider.notifier).setMe(me);
      if (!mounted) return;
      widget.editing ? context.pop() : context.go(widget.next ?? '/home');
    } catch (e) {
      setState(() => _error = errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    return Scaffold(
      appBar: AppBar(title: widget.editing ? Text(l.editProfile) : null, automaticallyImplyLeading: widget.editing),
      backgroundColor: C.surface,
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(S.screen), children: [
          if (!widget.editing) ...[Text(l.profileTitle, style: T.h1), const SizedBox(height: S.s5)],
          TextField(
            controller: _name,
            textCapitalization: TextCapitalization.words,
            maxLength: 40,
            onChanged: (_) => setState(() => _nameError = null),
            decoration: InputDecoration(labelText: l.yourName, helperText: l.nameHelp, errorText: _nameError, counterText: ''),
          ),
          const SizedBox(height: S.s4),
          Text(l.yourCity, style: T.label),
          const SizedBox(height: S.s1),
          CardBox(
            padding: const EdgeInsets.symmetric(horizontal: S.s3, vertical: S.s3),
            onTap: () async {
              final c = await context.push<City>('/choose-city?pick=1');
              if (c != null) setState(() => _city = c);
            },
            child: Row(children: [
              const Icon(PhosphorIconsRegular.mapPin, color: C.ink2),
              const SizedBox(width: S.s3),
              Expanded(child: Text(_city?.label(hindi) ?? l.chooseCity, style: _city == null ? T.body15.copyWith(color: C.ink2) : T.body15)),
              const Icon(PhosphorIconsRegular.caretRight, color: C.ink2, size: 18),
            ]),
          ),
          if (_error != null) ...[const SizedBox(height: S.s3), Text(_error!, style: T.secondary.copyWith(color: C.danger))],
          const SizedBox(height: S.s6),
          Btn(widget.editing ? l.save : l.continueLabel, loading: _busy, onPressed: _city == null || _name.text.trim().length < 2 ? null : _save),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-05 Choose city

class CityPickerScreen extends ConsumerStatefulWidget {
  const CityPickerScreen({super.key, this.pickOnly = false, this.guest = false});
  final bool pickOnly, guest;
  @override
  ConsumerState<CityPickerScreen> createState() => _CityPickerState();
}

class _CityPickerState extends ConsumerState<CityPickerScreen> {
  String _q = '';

  Future<void> _choose(City c) async {
    if (!c.isOpen) {
      await context.push('/coming-soon', extra: c);
      return;
    }
    if (widget.pickOnly) return context.pop(c);
    final session = ref.read(sessionProvider);
    if (session.signedIn) {
      try {
        final me = await ref.read(repoProvider).updateMe(cityId: c.id);
        ref.read(sessionProvider.notifier).setMe(me);
      } catch (e) {
        if (mounted) toast(context, errorText(L.of(context), e));
        return;
      }
    } else {
      ref.read(sessionProvider.notifier).setGuestCity(c.id);
    }
    if (!mounted) return;
    widget.guest ? context.go('/home') : context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final cities = ref.watch(citiesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.chooseCity)),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(S.screen),
          child: TextField(
            onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
            decoration: InputDecoration(hintText: l.searchCity, prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass)),
          ),
        ),
        Expanded(
          child: cities.when(
            loading: () => const ListSkeleton(rows: 6),
            error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(citiesProvider)),
            data: (list) {
              final shown = list.where((c) => _q.isEmpty || c.name.toLowerCase().contains(_q) || (c.nameHi ?? '').contains(_q) || c.state.toLowerCase().contains(_q)).toList();
              return ListView.separated(
                itemCount: shown.length,
                separatorBuilder: (_, _) => const Divider(indent: S.screen),
                itemBuilder: (_, i) {
                  final c = shown[i];
                  return ListTile(
                    minTileHeight: 56,
                    contentPadding: const EdgeInsets.symmetric(horizontal: S.screen),
                    title: Text(c.label(hindi), style: T.strong.copyWith(color: c.isOpen ? C.ink : C.ink2)),
                    subtitle: Text(c.state, style: T.secondary),
                    trailing: c.isOpen ? const Icon(PhosphorIconsRegular.caretRight, size: 18, color: C.ink2) : Text(l.comingSoon, style: T.label.copyWith(color: C.warning)),
                    onTap: () => _choose(c),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-06 Coming soon

class ComingSoonScreen extends ConsumerStatefulWidget {
  const ComingSoonScreen({super.key, required this.city});
  final City city;
  @override
  ConsumerState<ComingSoonScreen> createState() => _ComingSoonState();
}

class _ComingSoonState extends ConsumerState<ComingSoonScreen> {
  bool _busy = false, _done = false;

  Future<void> _notify() async {
    if (!ref.read(sessionProvider).signedIn) {
      await context.push('/login');
      if (!mounted || !ref.read(sessionProvider).signedIn) return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(repoProvider).joinWaitlist(widget.city.id);
      setState(() => _done = true);
    } catch (e) {
      if (mounted) toast(context, errorText(L.of(context), e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    return Scaffold(
      appBar: AppBar(),
      backgroundColor: C.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(S.screen),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(PhosphorIconsRegular.buildings, size: 44, color: C.primary),
            const SizedBox(height: S.s4),
            Text(l.comingSoonTitle(widget.city.label(hindi)), style: T.h1),
            const SizedBox(height: S.s2),
            Text(l.comingSoonBody, style: T.body15.copyWith(color: C.ink2)),
            const SizedBox(height: S.s6),
            if (_done)
              Row(children: [const Icon(PhosphorIconsFill.checkCircle, color: C.primary), const SizedBox(width: S.s2), Expanded(child: Text(l.waitlistDone, style: T.strong))])
            else
              Btn(l.notifyMe, loading: _busy, onPressed: _notify),
            const SizedBox(height: S.s2),
            Btn(l.chooseAnotherCity, kind: BtnKind.text, onPressed: () => context.pop()),
          ]),
        ),
      ),
    );
  }
}
