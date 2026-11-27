import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/icons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/config.dart';
import '../core/format.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/common.dart';
import '../widgets/item_card.dart';

// ---------------------------------------------------------------- A-23 Profile and settings (+ A-33 language)

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final s = ref.watch(sessionProvider);
    final me = s.me;
    final settings = ref.watch(settingsProvider).value;
    Widget tile(IconData i, String t, VoidCallback onTap, {String? sub, Color? color}) => ListTile(
          minTileHeight: 56,
          leading: Icon(i, color: color ?? C.ink2),
          title: Text(t, style: T.body15.copyWith(color: color)),
          subtitle: sub == null ? null : Text(sub, style: T.secondary),
          trailing: const Icon(PhosphorIconsRegular.caretRight, size: 18, color: C.ink2),
          onTap: onTap,
        );
    Future<void> setLang(String lang) async {
      if (!s.signedIn) return ref.read(sessionProvider.notifier).setGuestLanguage(lang);
      try {
        ref.read(sessionProvider.notifier).setMe(await ref.read(repoProvider).updateMe(language: lang));
        ref.invalidate(plansProvider);
        ref.invalidate(categoriesProvider);
      } catch (e) {
        if (context.mounted) toast(context, errorText(l, e));
      }
    }

    final langRow = Padding(
      padding: const EdgeInsets.symmetric(horizontal: S.screen, vertical: S.s2),
      child: Row(children: [
        const Icon(PhosphorIconsRegular.translate, color: C.ink2),
        const SizedBox(width: S.s4),
        Expanded(child: Text(l.language, style: T.body15)),
        SegmentedButton<String>(
          showSelectedIcon: false,
          segments: [ButtonSegment(value: 'en', label: Text(l.english)), ButtonSegment(value: 'hi', label: Text(l.hindi))],
          selected: {s.hindi ? 'hi' : 'en'},
          onSelectionChanged: (v) => setLang(v.first),
        ),
      ]),
    );

    return Scaffold(
      appBar: AppBar(title: Text(l.navProfile)),
      body: ListView(children: [
        if (me == null) ...[
          Padding(
            padding: const EdgeInsets.all(S.screen),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.guestProfile, style: T.h3),
              const SizedBox(height: S.s3),
              Btn(l.signIn, onPressed: () => context.push('/login')),
            ]),
          ),
          langRow,
          tile(PhosphorIconsRegular.lifebuoy, l.helpSafety, () => context.push('/help')),
          tile(PhosphorIconsRegular.fileText, l.termsPrivacy, () => _openLegal(context, settings)),
        ] else ...[
          Padding(
            padding: const EdgeInsets.all(S.screen),
            child: Row(children: [
              CircleAvatar(radius: 28, backgroundColor: C.primarySoft, child: Text((me.name ?? '?').characters.first.toUpperCase(), style: T.h2.copyWith(color: C.primary))),
              const SizedBox(width: S.s3),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(child: Text(me.name ?? '', style: T.h2, overflow: TextOverflow.ellipsis)),
                    if (me.idVerified) ...[const SizedBox(width: S.s1), const Icon(PhosphorIconsFill.sealCheck, size: 18, color: C.primary)],
                  ]),
                  Text('+91 ${me.phoneMasked} · ${me.city?.label(s.hindi) ?? ''}', style: T.secondary),
                  if (me.planName != null) Text('${me.planName} · ${l.daysLeft(me.planDaysLeft ?? 0)}', style: T.secondary.copyWith(color: C.primary)),
                ]),
              ),
            ]),
          ),
          tile(PhosphorIconsRegular.pencilSimple, l.editProfile, () => context.push('/edit-profile')),
          me.isLister ? tile(PhosphorIconsRegular.tag, l.myPlan, () => context.push('/plans')) : tile(PhosphorIconsRegular.storefront, l.startRenting, () => context.push('/add-item')),
          tile(PhosphorIconsRegular.receipt, l.myPayments, () => context.push('/payments')),
          tile(PhosphorIconsRegular.megaphoneSimple, l.requests, () => context.push('/my-requests')),
          tile(PhosphorIconsRegular.gift, l.referFriend, () => context.push('/refer')),
          if (me.isLister) tile(PhosphorIconsRegular.identificationCard, l.getVerified, () => context.push('/id-verify')),
          if (me.isLister) tile(PhosphorIconsRegular.storefront, l.myShop, () => context.push('/my-shop')),
          tile(PhosphorIconsRegular.bell, l.notificationsTitle, () => context.push('/notifications')),
          const Divider(),
          langRow,
          tile(PhosphorIconsRegular.lifebuoy, l.helpSafety, () => context.push('/help')),
          tile(PhosphorIconsRegular.fileText, l.termsPrivacy, () => _openLegal(context, settings)),
          const Divider(),
          tile(PhosphorIconsRegular.trash, l.deleteMyAccount, () => context.push('/delete-account'), color: C.danger),
          tile(PhosphorIconsRegular.signOut, l.logout, () async {
            String? fcm;
            try {
              if (Config.hasFirebase) fcm = await FirebaseMessaging.instance.getToken();
            } catch (_) {}
            await ref.read(sessionProvider.notifier).signOut(fcmToken: fcm);
            if (context.mounted) context.go('/welcome');
          }),
          const SizedBox(height: S.s6),
        ],
      ]),
    );
  }

  void _openLegal(BuildContext context, PublicSettings? s) {
    final l = L.of(context);
    showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(l.terms), onTap: () => launchUrl(Uri.parse(s?.termsUrl ?? '${Config.webUrl}/terms'))),
          ListTile(title: Text(l.privacyPolicy), onTap: () => launchUrl(Uri.parse(s?.privacyUrl ?? '${Config.webUrl}/privacy'))),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-22 Notifications

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  IconData _icon(String type) => switch (type) {
        'PAYMENT_APPROVED' || 'PLAN_ACTIVATED' => PhosphorIconsRegular.checkCircle,
        'PAYMENT_REJECTED' || 'LISTING_REJECTED' || 'ID_REJECTED' => PhosphorIconsRegular.warningCircle,
        'PLAN_EXPIRING' || 'PLAN_EXPIRED' => PhosphorIconsRegular.hourglass,
        'ITEM_REQUEST' => PhosphorIconsRegular.megaphoneSimple,
        'CITY_OPENED' => PhosphorIconsRegular.mapPin,
        'BOOST_STARTED' => PhosphorIconsRegular.rocketLaunch,
        'REFERRAL_REWARD' => PhosphorIconsRegular.gift,
        _ => PhosphorIconsRegular.bell,
      };

  void _open(BuildContext context, AppNotification n) {
    final d = n.data;
    final String? path = d['listingId'] != null
        ? '/item/${d['listingId']}'
        : d['paymentId'] != null
            ? '/payment/${d['paymentId']}'
            : d['requestId'] != null
                ? '/request-reply/${d['requestId']}'
                : n.type.startsWith('PLAN')
                    ? '/plans'
                    : null;
    if (path != null) unawaited(context.push(path));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final list = ref.watch(notificationsProvider);
    final locale = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l.notificationsTitle), actions: [
        TextButton(
          onPressed: () async {
            await ref.read(repoProvider).markRead(all: true);
            ref.invalidate(notificationsProvider);
          },
          child: Text(l.markAllRead),
        ),
      ]),
      body: list.when(
        loading: () => const ListSkeleton(rows: 5),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(notificationsProvider)),
        data: (r) => r.items.isEmpty
            ? EmptyState(icon: PhosphorIconsRegular.bellSimple, text: l.notificationsEmpty)
            : RefreshIndicator(
                onRefresh: () => ref.refresh(notificationsProvider.future),
                child: ListView.separated(
                  itemCount: r.items.length,
                  separatorBuilder: (_, _) => const Divider(indent: 64),
                  itemBuilder: (_, i) {
                    final n = r.items[i];
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: S.screen, vertical: S.s1),
                      leading: Icon(_icon(n.type), color: C.primary),
                      title: Text(n.title, style: n.read ? T.body15 : T.strong),
                      subtitle: Text(n.body, style: T.secondary),
                      trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text(timeAgo(n.createdAt, locale), style: T.label),
                        if (!n.read) ...[const SizedBox(height: S.s1), Container(width: 8, height: 8, decoration: const BoxDecoration(color: C.accent, shape: BoxShape.circle))],
                      ]),
                      onTap: () async {
                        if (!n.read) {
                          unawaited(ref.read(repoProvider).markRead(ids: [n.id]).then((_) => ref.invalidate(notificationsProvider)));
                        }
                        _open(context, n);
                      },
                    );
                  },
                ),
              ),
      ),
    );
  }
}

/// Push permission is asked at a useful moment (after the first listing or
/// first save), never on first launch.
Future<void> maybeAskForPush(BuildContext context, WidgetRef ref) async {
  if (!Config.hasFirebase) return;
  final store = ref.read(storeProvider);
  if (await store.pushAsked || !context.mounted) return;
  await store.markPushAsked();
  if (!context.mounted) return;
  final l = L.of(context);
  final yes = await showModalBottomSheet<bool>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.pushAskTitle, style: T.h2),
          const SizedBox(height: S.s2),
          Text(l.pushAskBody, style: T.body15.copyWith(color: C.ink2)),
          const SizedBox(height: S.s4),
          Btn(l.allow, onPressed: () => Navigator.pop(ctx, true)),
          Btn(l.notNow, kind: BtnKind.text, onPressed: () => Navigator.pop(ctx, false)),
        ]),
      ),
    ),
  );
  if (yes != true) return;
  final settings = await FirebaseMessaging.instance.requestPermission();
  if (settings.authorizationStatus != AuthorizationStatus.authorized) return;
  final token = await FirebaseMessaging.instance.getToken();
  if (token != null) await ref.read(repoProvider).registerDevice(token);
}

// ---------------------------------------------------------------- A-24 Delete my account

class DeleteAccountScreen extends ConsumerStatefulWidget {
  const DeleteAccountScreen({super.key});
  @override
  ConsumerState<DeleteAccountScreen> createState() => _DeleteState();
}

class _DeleteState extends ConsumerState<DeleteAccountScreen> {
  final _reason = TextEditingController();
  final _otp = TextEditingController();
  String? _verificationId, _error;
  bool _busy = false;

  Future<void> _sendOtp() async {
    final l = L.of(context);
    // The OTP goes to the account's own number; the app only knows it masked,
    // so the person types it once more.
    final number = await showDialog<String>(context: context, builder: (ctx) => _NumberDialog());
    if (number == null) return;
    setState(() => _busy = true);
    try {
      _verificationId = await ref.read(phoneAuthProvider).sendCode('+91$number');
    } catch (_) {
      _error = l.tooManyAttempts;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final l = L.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = await ref.read(phoneAuthProvider).confirm(_verificationId!, _otp.text);
      await ref.read(repoProvider).requestDeletion(token, _reason.text.trim());
      await ref.read(storeProvider).clear();
      await ref.read(sessionProvider.notifier).signOut();
      if (!mounted) return;
      context.go('/welcome');
      toast(context, l.deleteStarted);
    } on ApiException catch (e) {
      setState(() => _error = errorText(l, e));
    } catch (_) {
      setState(() => _error = l.wrongCode);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final me = ref.watch(sessionProvider).me;
    Widget point(IconData i, String t, [Color c = C.ink2]) => Padding(
          padding: const EdgeInsets.only(bottom: S.s3),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Icon(i, color: c, size: 20), const SizedBox(width: S.s3), Expanded(child: Text(t, style: T.body15))]),
        );
    return Scaffold(
      appBar: AppBar(title: Text(l.deleteTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        point(PhosphorIconsRegular.trash, l.deleteWhat, C.danger),
        point(PhosphorIconsRegular.archive, l.deleteKept),
        point(PhosphorIconsRegular.clock, l.deleteTiming),
        if (me?.planName != null) point(PhosphorIconsRegular.warning, l.deletePlanWarning, C.warning),
        const SizedBox(height: S.s2),
        TextField(controller: _reason, maxLength: 300, maxLines: 2, decoration: InputDecoration(labelText: l.reasonOptional)),
        const SizedBox(height: S.s3),
        if (_verificationId == null)
          Btn(l.confirmWithOtp, kind: BtnKind.secondary, loading: _busy, onPressed: _sendOtp)
        else ...[
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(labelText: l.otpTitle, counterText: '', errorText: _error),
          ),
          const SizedBox(height: S.s3),
          Btn(l.deleteFinal, kind: BtnKind.danger, loading: _busy, onPressed: _otp.text.length == 6 ? _delete : null),
        ],
        if (_error != null && _verificationId == null) Text(_error!, style: T.secondary.copyWith(color: C.danger)),
      ]),
    );
  }
}

class _NumberDialog extends StatefulWidget {
  @override
  State<_NumberDialog> createState() => _NumberDialogState();
}

class _NumberDialogState extends State<_NumberDialog> {
  final _c = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return AlertDialog(
      title: Text(l.enterMobileTitle),
      content: TextField(
        controller: _c,
        autofocus: true,
        keyboardType: TextInputType.phone,
        maxLength: 10,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: const InputDecoration(prefixText: '+91 ', counterText: ''),
        onChanged: (_) => setState(() {}),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(l.cancel)),
        TextButton(onPressed: RegExp(r'^[6-9]\d{9}$').hasMatch(_c.text) ? () => Navigator.pop(context, _c.text) : null, child: Text(l.sendOtp)),
      ],
    );
  }
}

// ---------------------------------------------------------------- A-25 Help, safety and legal

class HelpScreen extends ConsumerWidget {
  const HelpScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final s = ref.watch(settingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.helpSafety)),
      body: s.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(settingsProvider)),
        data: (st) => ListView(padding: const EdgeInsets.all(S.screen), children: [
          Text(l.howItWorks, style: T.h3),
          const SizedBox(height: S.s2),
          Text(l.howItWorksBody, style: T.body15),
          const SizedBox(height: S.s5),
          Text(l.safetyTips, style: T.h3),
          const SizedBox(height: S.s2),
          for (final t in hindi ? st.safetyTipsHi : st.safetyTips)
            Padding(padding: const EdgeInsets.only(bottom: S.s2), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(PhosphorIconsRegular.shieldCheck, color: C.primary, size: 20), const SizedBox(width: S.s2), Expanded(child: Text(t, style: T.body15))])),
          const SizedBox(height: S.s4),
          Text(l.faqs, style: T.h3),
          for (final f in hindi ? st.faqsHi : st.faqs)
            ExpansionTile(tilePadding: EdgeInsets.zero, title: Text(f.q, style: T.strong), childrenPadding: const EdgeInsets.only(bottom: S.s3), expandedAlignment: Alignment.centerLeft, children: [Text(f.a, style: T.body15)]),
          const SizedBox(height: S.s4),
          Text(l.contactSupport, style: T.h3),
          const SizedBox(height: S.s2),
          if (st.supportWhatsapp != null)
            Btn('WhatsApp ${st.supportWhatsapp}', kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, onPressed: () => launchUrl(Uri.parse('https://wa.me/${st.supportWhatsapp!.replaceAll('+', '')}'), mode: LaunchMode.externalApplication)),
          if (st.supportEmail != null) ...[const SizedBox(height: S.s2), SelectableText(st.supportEmail!, style: T.body15.copyWith(color: C.primary))],
          Text(st.supportHours, style: T.secondary),
          const SizedBox(height: S.s5),
          Text(l.grievanceOfficer, style: T.h3),
          const SizedBox(height: S.s1),
          Text(st.grievanceName, style: T.body15),
          SelectableText(st.grievanceEmail, style: T.body15.copyWith(color: C.primary)),
          const SizedBox(height: S.s4),
          Row(children: [
            TextButton(onPressed: () => launchUrl(Uri.parse(st.termsUrl)), child: Text(l.terms)),
            TextButton(onPressed: () => launchUrl(Uri.parse(st.privacyUrl)), child: Text(l.privacyPolicy)),
          ]),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-27 Refer a friend

class ReferScreen extends ConsumerStatefulWidget {
  const ReferScreen({super.key});
  @override
  ConsumerState<ReferScreen> createState() => _ReferState();
}

final _referralProvider = FutureProvider<Json>((ref) => ref.watch(repoProvider).referral());

class _ReferState extends ConsumerState<ReferScreen> {
  final _code = TextEditingController();
  String? _error;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final r = ref.watch(_referralProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.referTitle)),
      body: r.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_referralProvider)),
        data: (d) => ListView(padding: const EdgeInsets.all(S.screen), children: [
          const Icon(PhosphorIconsRegular.gift, size: 40, color: C.primary),
          const SizedBox(height: S.s3),
          Text(l.referBody((d['rewardDays'] as num).toInt()), style: T.body15),
          const SizedBox(height: S.s5),
          Text(l.yourCode, style: T.label),
          const SizedBox(height: S.s1),
          CardBox(child: Row(children: [
            Expanded(child: SelectableText(d['code'] as String, style: T.h1.copyWith(letterSpacing: 3))),
            IconButton(tooltip: l.copyLink, icon: const Icon(PhosphorIconsRegular.copy), onPressed: () async {
              await Clipboard.setData(ClipboardData(text: d['code'] as String));
              if (context.mounted) toast(context, l.linkCopied);
            }),
          ])),
          const SizedBox(height: S.s3),
          Btn(l.shareCode, icon: PhosphorIconsRegular.shareNetwork, onPressed: () => SharePlus.instance.share(ShareParams(text: '${l.tagline} — RentNook. ${d['shareLink']}'))),
          const SizedBox(height: S.s3),
          Text(l.rewardsEarned((d['rewardsEarned'] as num).toInt(), (d['daysEarned'] as num).toInt()), style: T.secondary),
          if (d['appliedCode'] != true) ...[
            const SizedBox(height: S.s6),
            Text(l.haveCode, style: T.h3),
            const SizedBox(height: S.s2),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: TextField(controller: _code, textCapitalization: TextCapitalization.characters, maxLength: 10, decoration: InputDecoration(counterText: '', errorText: _error))),
              const SizedBox(width: S.s2),
              Btn(l.applyCoupon, kind: BtnKind.secondary, full: false, onPressed: () async {
                try {
                  await ref.read(repoProvider).applyReferral(_code.text.trim());
                  ref.invalidate(_referralProvider);
                  if (context.mounted) toast(context, l.codeApplied);
                } catch (e) {
                  setState(() => _error = errorText(l, e));
                }
              }),
            ]),
          ],
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-29 Request an item

class RequestItemScreen extends ConsumerStatefulWidget {
  const RequestItemScreen({super.key, this.text, this.categoryId});
  final String? text, categoryId;
  @override
  ConsumerState<RequestItemScreen> createState() => _RequestState();
}

class _RequestState extends ConsumerState<RequestItemScreen> {
  late final _text = TextEditingController(text: widget.text ?? '');
  late String? _cat = widget.categoryId?.isEmpty ?? true ? null : widget.categoryId;
  DateTime _from = DateTime.now();
  DateTime _to = DateTime.now().add(const Duration(days: 2));
  bool _busy = false;
  String? _error;

  String _iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final locale = hindi ? 'hi' : 'en';
    final cats = ref.watch(categoriesProvider).value ?? const <Category>[];
    Future<void> pick(bool from) async {
      final d = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 90)), initialDate: from ? _from : _to);
      if (d == null) return;
      setState(() {
        if (from) {
          _from = d;
          if (_to.isBefore(d)) _to = d;
        } else {
          _to = d.isBefore(_from) ? _from : d;
        }
      });
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.requestTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        TextField(controller: _text, maxLength: 200, maxLines: 3, onChanged: (_) => setState(() {}), decoration: InputDecoration(labelText: l.requestWhat, hintText: l.requestWhatHint)),
        const SizedBox(height: S.s3),
        DropdownButtonFormField<String>(
          initialValue: cats.any((c) => c.id == _cat) ? _cat : null,
          decoration: InputDecoration(labelText: l.category),
          items: [for (final c in cats) DropdownMenuItem(value: c.id, child: Text(c.label(hindi)))],
          onChanged: (v) => setState(() => _cat = v),
        ),
        const SizedBox(height: S.s4),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: () => pick(true), icon: const Icon(PhosphorIconsRegular.calendarBlank), label: Text('${l.fromDate}: ${shortDate(_from.toIso8601String(), locale)}'))),
          const SizedBox(width: S.s2),
          Expanded(child: OutlinedButton.icon(onPressed: () => pick(false), icon: const Icon(PhosphorIconsRegular.calendarBlank), label: Text('${l.toDate}: ${shortDate(_to.toIso8601String(), locale)}'))),
        ]),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: S.s3), child: Text(_error!, style: T.secondary.copyWith(color: C.danger))),
        const SizedBox(height: S.s5),
        Btn(l.post, loading: _busy, onPressed: _text.text.trim().length < 10 || _cat == null
            ? null
            : () async {
                setState(() {
                  _busy = true;
                  _error = null;
                });
                try {
                  final r = await ref.read(repoProvider).postRequest({'text': _text.text.trim(), 'categoryId': _cat, 'fromDate': _iso(_from), 'toDate': _iso(_to)});
                  if (!context.mounted) return;
                  toast(context, l.requestPosted((r['notified'] as num).toInt()));
                  context.pop();
                } on ApiException catch (e) {
                  setState(() => _error = e.code == 'REQUEST_LIMIT' ? l.requestLimit : errorText(l, e));
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              }),
      ]),
    );
  }
}

final _myRequestsProvider = FutureProvider<List<Json>>((ref) => ref.watch(repoProvider).myRequests());

class MyRequestsScreen extends ConsumerWidget {
  const MyRequestsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final r = ref.watch(_myRequestsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.requests), actions: [IconButton(tooltip: l.requestTitle, icon: const Icon(PhosphorIconsRegular.plus), onPressed: () => context.push('/request'))]),
      body: r.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_myRequestsProvider)),
        data: (items) => items.isEmpty
            ? EmptyState(icon: PhosphorIconsRegular.megaphoneSimple, text: l.requestsEmpty, action: l.requestTitle, onAction: () => context.push('/request'))
            : ListView.separated(
                padding: const EdgeInsets.all(S.screen),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: S.s2),
                itemBuilder: (_, i) {
                  final x = items[i];
                  return CardBox(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(x['text'] as String, style: T.strong),
                      Text('${(x['category'] as Json)['name']} · ${x['fromDate']} → ${x['toDate']}', style: T.secondary),
                      Row(children: [
                        Icon(x['status'] == 'OPEN' ? PhosphorIconsRegular.usersThree : PhosphorIconsRegular.archive, size: 16, color: C.ink2),
                        const SizedBox(width: S.s1),
                        Text(x['status'] == 'OPEN' ? '${x['notifiedCount']}' : l.statusHIDDEN, style: T.label),
                      ]),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}

/// Lister side: opened from the "Someone needs" push.
class RequestReplyScreen extends ConsumerWidget {
  const RequestReplyScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.requestTitle)),
      body: FutureBuilder<Json>(
        future: ref.read(repoProvider).requestDetail(id),
        builder: (context, snap) {
          if (snap.hasError) return EmptyState(icon: PhosphorIconsRegular.megaphoneSimple, text: errorText(l, snap.error!));
          if (!snap.hasData) return const ListSkeleton(rows: 2);
          final r = snap.data!;
          return ListView(padding: const EdgeInsets.all(S.screen), children: [
            Text(r['text'] as String, style: T.h2),
            const SizedBox(height: S.s2),
            Text('${r['firstName']} · ${(r['category'] as Json)['name']} · ${r['fromDate']} → ${r['toDate']}', style: T.secondary),
            const SizedBox(height: S.s5),
            Btn(l.replyOnWhatsapp, kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, onPressed: () async {
              try {
                final url = await ref.read(repoProvider).replyToRequest(id);
                await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              } catch (e) {
                if (context.mounted) toast(context, errorText(l, e));
              }
            }),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- A-31 Get ID verified

final _idProvider = FutureProvider<Json>((ref) => ref.watch(repoProvider).idStatus());

class IdVerifyScreen extends ConsumerStatefulWidget {
  const IdVerifyScreen({super.key});
  @override
  ConsumerState<IdVerifyScreen> createState() => _IdState();
}

class _IdState extends ConsumerState<IdVerifyScreen> {
  bool _busy = false;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final s = ref.watch(_idProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.idTitle)),
      body: s.when(
        loading: () => const ListSkeleton(rows: 2),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_idProvider)),
        data: (d) {
          final latest = d['latest'] as Json?;
          final status = latest?['status'] as String?;
          return ListView(padding: const EdgeInsets.all(S.screen), children: [
            const Icon(PhosphorIconsRegular.identificationCard, size: 40, color: C.primary),
            const SizedBox(height: S.s3),
            Text(l.idBody, style: T.body15),
            const SizedBox(height: S.s5),
            if (d['verified'] == true)
              Row(children: [const Icon(PhosphorIconsFill.sealCheck, color: C.primary), const SizedBox(width: S.s2), Text(l.idVerified, style: T.strong)])
            else if (status == 'PENDING')
              Row(children: [const Icon(PhosphorIconsRegular.hourglass, color: C.warning), const SizedBox(width: S.s2), Expanded(child: Text(l.idPending, style: T.strong))])
            else ...[
              if (status == 'REJECTED') Padding(padding: const EdgeInsets.only(bottom: S.s3), child: Text(l.idRejected(latest?['rejectReason'] as String? ?? ''), style: T.secondary.copyWith(color: C.danger))),
              Btn(l.uploadId, loading: _busy, icon: PhosphorIconsRegular.camera, onPressed: () async {
                final x = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, imageQuality: 85);
                if (x == null) return;
                setState(() => _busy = true);
                try {
                  final id = await ref.read(repoProvider).upload('id', await x.readAsBytes(), 'image/jpeg');
                  await ref.read(repoProvider).submitId(id);
                  ref.invalidate(_idProvider);
                } catch (e) {
                  if (context.mounted) toast(context, errorText(l, e));
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              }),
            ],
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- A-32 Shop page (edit + view)

final _myShopProvider = FutureProvider<Json>((ref) => ref.watch(repoProvider).myShop());

class MyShopScreen extends ConsumerStatefulWidget {
  const MyShopScreen({super.key});
  @override
  ConsumerState<MyShopScreen> createState() => _MyShopState();
}

class _MyShopState extends ConsumerState<MyShopScreen> {
  final _name = TextEditingController(), _timings = TextEditingController(), _about = TextEditingController();
  String? _areaId, _logoId;
  bool _loaded = false, _busy = false;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final shop = ref.watch(_myShopProvider);
    final city = ref.watch(currentCityIdProvider);
    final areas = city == null ? const <Area>[] : ref.watch(areasProvider(city)).value ?? const <Area>[];
    return Scaffold(
      appBar: AppBar(title: Text(l.shopTitle)),
      body: shop.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_myShopProvider)),
        data: (d) {
          if (d['allowed'] != true) {
            return EmptyState(icon: PhosphorIconsRegular.storefront, text: l.shopNeedsBusiness, action: l.choosePlan, onAction: () => context.push('/plans'));
          }
          final s = d['shop'] as Json?;
          if (!_loaded && s != null) {
            _loaded = true;
            _name.text = s['shopName'] as String;
            _timings.text = s['timings'] as String;
            _about.text = s['about'] as String;
            _areaId = (s['area'] as Json)['id'] as String;
          }
          return ListView(padding: const EdgeInsets.all(S.screen), children: [
            TextField(controller: _name, maxLength: 50, decoration: InputDecoration(labelText: l.shopName)),
            DropdownButtonFormField<String>(
              initialValue: areas.any((a) => a.id == _areaId) ? _areaId : null,
              decoration: InputDecoration(labelText: l.area),
              items: [for (final a in areas) DropdownMenuItem(value: a.id, child: Text(a.name))],
              onChanged: (v) => setState(() => _areaId = v),
            ),
            const SizedBox(height: S.s4),
            TextField(controller: _timings, maxLength: 80, decoration: InputDecoration(labelText: l.timings, hintText: '10 am – 8 pm, Mon–Sat')),
            TextField(controller: _about, maxLength: 500, maxLines: 4, decoration: InputDecoration(labelText: l.about)),
            Btn(_logoId != null ? l.screenshotAttached : l.logo, kind: BtnKind.secondary, icon: PhosphorIconsRegular.image, onPressed: () async {
              final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 512, imageQuality: 85);
              if (x == null) return;
              try {
                _logoId = await ref.read(repoProvider).upload('logo', await x.readAsBytes(), 'image/jpeg');
                setState(() {});
              } catch (e) {
                if (context.mounted) toast(context, errorText(l, e));
              }
            }),
            const SizedBox(height: S.s3),
            Btn(l.save, loading: _busy, onPressed: _areaId == null || _name.text.trim().length < 3
                ? null
                : () async {
                    setState(() => _busy = true);
                    try {
                      final r = await ref.read(repoProvider).saveShop({'shopName': _name.text.trim(), 'areaId': _areaId, 'timings': _timings.text.trim(), 'about': _about.text.trim(), 'logoUploadId': ?_logoId});
                      ref.invalidate(_myShopProvider);
                      if (context.mounted) {
                        toast(context, l.shopSaved);
                        await SharePlus.instance.share(ShareParams(text: r['shareLink'] as String));
                      }
                    } catch (e) {
                      if (context.mounted) toast(context, errorText(l, e));
                    } finally {
                      if (mounted) setState(() => _busy = false);
                    }
                  }),
            if (s != null) ...[const SizedBox(height: S.s2), Btn(l.share, kind: BtnKind.text, onPressed: () => context.push('/shop/${s['id']}'))],
          ]);
        },
      ),
    );
  }
}

final _shopProvider = FutureProvider.family<Json, String>((ref, id) => ref.watch(repoProvider).shop(id));

class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final s = ref.watch(_shopProvider(id));
    return Scaffold(
      appBar: AppBar(actions: [
        if (s.value != null) IconButton(tooltip: l.share, icon: const Icon(PhosphorIconsRegular.shareNetwork), onPressed: () => SharePlus.instance.share(ShareParams(text: s.value!['shareLink'] as String))),
      ]),
      body: s.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_shopProvider(id))),
        data: (d) => ListView(padding: const EdgeInsets.all(S.screen), children: [
          Row(children: [
            SizedBox(width: 64, child: Photo(d['logo'] as String?, ratio: 1, icon: PhosphorIconsRegular.storefront)),
            const SizedBox(width: S.s3),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(d['shopName'] as String, style: T.h2)),
                  if (d['verified'] == true) ...[const SizedBox(width: S.s1), const Icon(PhosphorIconsFill.sealCheck, color: C.primary, size: 18)],
                ]),
                Text('${(d['area'] as Json)['name']} · ${d['timings']}', style: T.secondary),
              ]),
            ),
          ]),
          const SizedBox(height: S.s3),
          Text(d['about'] as String, style: T.body15),
          const SizedBox(height: S.s4),
          for (final i in (d['items'] as List).cast<Json>()) Padding(padding: const EdgeInsets.only(bottom: S.s3), child: ItemCard(ListingCard.fromJson(i))),
        ]),
      ),
    );
  }
}
