import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/icons.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../core/secure_flag.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/common.dart';

// ---------------------------------------------------------------- A-16 Plans (+ A-26 trial, coupon)

class PlansScreen extends ConsumerStatefulWidget {
  const PlansScreen({super.key});
  @override
  ConsumerState<PlansScreen> createState() => _PlansState();
}

class _PlansState extends ConsumerState<PlansScreen> {
  String? _selected;
  final _coupon = TextEditingController();
  int? _discount;
  String? _couponError;
  bool _busy = false;

  Future<void> _applyCoupon(Plan p) async {
    final l = L.of(context);
    setState(() => _couponError = null);
    try {
      final r = await ref.read(repoProvider).validateCoupon(p.id, _coupon.text.trim().toUpperCase());
      setState(() => _discount = (r['discountPaise'] as num).toInt());
    } catch (e) {
      setState(() {
        _discount = null;
        _couponError = errorText(l, e);
      });
    }
  }

  Future<void> _go(Plan p) async {
    final l = L.of(context);
    setState(() => _busy = true);
    try {
      final r = await ref.read(repoProvider).subscribe(p.id, coupon: _discount != null ? _coupon.text.trim().toUpperCase() : null);
      ref.invalidate(plansProvider);
      ref.invalidate(listerSummaryProvider);
      if (!mounted) return;
      final pay = r['payment'] as Json?;
      if (pay != null) {
        await context.push('/pay', extra: Payment.fromJson(pay));
        return;
      }
      final sub = r['subscription'] as Json;
      await ref.read(sessionProvider.notifier).refreshMe();
      ref.invalidate(myListingsProvider);
      if (!mounted) return;
      toast(context, sub['status'] == 'PENDING' ? l.waitingApproval : l.planActive(shortDate(sub['endsAt'] as String, Localizations.localeOf(context).languageCode)));
      context.pop();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.code == 'ALREADY_USED' ? l.alreadyUsed : errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final plans = ref.watch(plansProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.plansTitle), actions: [TextButton(onPressed: () => context.push('/payments'), child: Text(l.myPayments))]),
      body: plans.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(plansProvider)),
        data: (list) {
          if (list.isEmpty) return EmptyState(icon: PhosphorIconsRegular.tag, text: l.plansSoon);
          final free = list.where((p) => p.isFree).toList();
          final paid = list.where((p) => !p.isFree).toList();
          final sel = list.where((p) => p.id == _selected).firstOrNull;
          final total = sel == null ? 0 : sel.pricePaise - (_discount ?? 0);
          return Column(children: [
            Expanded(
              child: ListView(padding: const EdgeInsets.all(S.screen), children: [
                if (free.isNotEmpty) ...[
                  Text(l.freePlans, style: T.h3),
                  const SizedBox(height: S.s2),
                  for (final p in free) _FreePlanCard(p, busy: _busy, onActivate: () => _go(p)),
                  const SizedBox(height: S.s4),
                ],
                if (paid.isNotEmpty) ...[
                  Text(l.paidPlans, style: T.h3),
                  const SizedBox(height: S.s2),
                  for (final p in paid)
                    Padding(
                      padding: const EdgeInsets.only(bottom: S.s3),
                      child: _PlanTile(p, selected: p.id == _selected, onTap: () => setState(() {
                        _selected = p.id;
                        _discount = null;
                        _couponError = null;
                      })),
                    ),
                  if (sel != null) ...[
                    const SizedBox(height: S.s2),
                    Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        child: TextField(
                          controller: _coupon,
                          textCapitalization: TextCapitalization.characters,
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp('[A-Za-z0-9]')), LengthLimitingTextInputFormatter(20)],
                          decoration: InputDecoration(hintText: l.couponHint, errorText: _couponError, helperText: _discount == null ? null : l.couponSaved(rupees(_discount!))),
                        ),
                      ),
                      const SizedBox(width: S.s2),
                      Btn(l.applyCoupon, kind: BtnKind.secondary, full: false, onPressed: _coupon.text.length >= 4 ? () => _applyCoupon(sel) : null),
                    ]),
                  ],
                ],
              ]),
            ),
            if (sel != null)
              SafeArea(
                child: Container(
                  padding: const EdgeInsets.all(S.screen),
                  decoration: const BoxDecoration(color: C.surface, border: Border(top: BorderSide(color: C.line))),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Row(children: [Text(l.total, style: T.secondary), const Spacer(), Text(rupees(total), style: T.priceLarge)]),
                    const SizedBox(height: S.s2),
                    Btn(l.payViaUpi(rupees(total)), loading: _busy, onPressed: () => _go(sel)),
                  ]),
                ),
              ),
          ]);
        },
      ),
    );
  }
}

class _FreePlanCard extends StatelessWidget {
  const _FreePlanCard(this.p, {required this.busy, required this.onActivate});
  final Plan p;
  final bool busy;
  final VoidCallback onActivate;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: S.s3),
      child: Container(
        padding: const EdgeInsets.all(S.s4),
        decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.card)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(p.name, style: T.h3),
          const SizedBox(height: S.s1),
          Text('${l.days(p.durationDays)} · ${p.listingLimit == null ? l.unlimitedItems : l.itemsLimit(p.listingLimit!)}', style: T.body15),
          for (final pt in p.points) Text('· $pt', style: T.secondary),
          const SizedBox(height: S.s3),
          p.alreadyUsed ? Text(l.alreadyUsed, style: T.secondary) : Btn(l.activateFree, loading: busy, onPressed: onActivate),
        ]),
      ),
    );
  }
}

class _PlanTile extends StatelessWidget {
  const _PlanTile(this.p, {required this.selected, required this.onTap});
  final Plan p;
  final bool selected;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Material(
      color: C.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.card), side: BorderSide(color: selected ? C.primary : C.line, width: selected ? 2 : 1)),
      child: InkWell(
        borderRadius: BorderRadius.circular(R.card),
        onTap: p.alreadyUsed ? null : onTap,
        child: Padding(
          padding: const EdgeInsets.all(S.s4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(selected ? PhosphorIconsFill.radioButton : PhosphorIconsRegular.circle, color: selected ? C.primary : C.ink2),
            const SizedBox(width: S.s3),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(p.name, style: T.h3)),
                  if (p.badge != null) ...[
                    const SizedBox(width: S.s2),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: S.s2, vertical: 1),
                      decoration: BoxDecoration(color: C.accent, borderRadius: BorderRadius.circular(6)),
                      child: Text(p.badge!, style: T.label.copyWith(color: C.surface, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ]),
                Text('${l.days(p.durationDays)} · ${p.listingLimit == null ? l.unlimitedItems : l.itemsLimit(p.listingLimit!)}', style: T.secondary),
                for (final pt in p.points) Text('· $pt', style: T.secondary),
                if (p.alreadyUsed) Text(l.alreadyUsed, style: T.label.copyWith(color: C.danger)),
              ]),
            ),
            Text(rupees(p.pricePaise), style: T.priceLarge),
          ]),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-17 Pay with UPI

class PayScreen extends ConsumerWidget {
  const PayScreen({super.key, required this.payment});
  final Payment payment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final upi = payment.upi!;
    Widget row(String k, String v, {bool mono = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: S.s2),
          child: Row(children: [
            SizedBox(width: 110, child: Text(k, style: T.secondary)),
            Expanded(child: Text(v, style: mono ? T.strong.copyWith(fontFeatures: const [FontFeature.tabularFigures()]) : T.strong)),
          ]),
        );
    return Scaffold(
      appBar: AppBar(title: Text(l.payTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        CardBox(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.payTo, style: T.secondary),
            Text(upi.payeeName, style: T.h2),
            const SizedBox(height: S.s2),
            Text(rupees(upi.amountPaise), style: T.priceLarge.copyWith(fontSize: 28)),
            const Divider(height: S.s6),
            row(l.upiId, upi.upiId),
            row(l.paymentFor, payment.planName ?? l.boost),
            row(l.reference, upi.reference, mono: true),
          ]),
        ),
        const SizedBox(height: S.s4),
        // Link built by the server from its own settings: payee, amount and
        // note cannot be edited on the phone.
        Btn(l.openUpiApp, icon: PhosphorIconsRegular.currencyInr, onPressed: () async {
          final ok = await launchUrl(Uri.parse(upi.upiLink), mode: LaunchMode.externalApplication);
          if (!ok && context.mounted) toast(context, l.noUpiApp);
        }),
        const SizedBox(height: S.s5),
        Text(l.scanQr, style: T.secondary),
        const SizedBox(height: S.s2),
        Center(
          child: Container(
            padding: const EdgeInsets.all(S.s3),
            decoration: BoxDecoration(color: C.surface, borderRadius: BorderRadius.circular(R.card), border: Border.all(color: C.line)),
            child: upi.qrUrl != null ? Image.network(upi.qrUrl!, width: 200, height: 200) : QrImageView(data: upi.upiLink, size: 200, eyeStyle: const QrEyeStyle(color: C.ink, eyeShape: QrEyeShape.square), dataModuleStyle: const QrDataModuleStyle(color: C.ink)),
          ),
        ),
        const SizedBox(height: S.s5),
        Text(l.afterPaying, style: T.body15),
        const SizedBox(height: S.s3),
        Btn(l.iHavePaid, kind: BtnKind.secondary, onPressed: () => context.pushReplacement('/utr', extra: payment)),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-18 Enter UTR

class UtrScreen extends ConsumerStatefulWidget {
  const UtrScreen({super.key, required this.payment});
  final Payment payment;
  @override
  ConsumerState<UtrScreen> createState() => _UtrState();
}

class _UtrState extends ConsumerState<UtrScreen> {
  final _utr = TextEditingController();
  String? _shotId, _error;
  bool _uploading = false, _busy = false;

  @override
  void initState() {
    super.initState();
    // FLAG_SECURE: other apps and screen recorders cannot capture this screen.
    unawaited(SecureFlag.on());
  }

  @override
  void dispose() {
    unawaited(SecureFlag.off());
    super.dispose();
  }

  Future<void> _pickShot() async {
    final l = L.of(context);
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2000, imageQuality: 85);
    if (x == null) return;
    setState(() => _uploading = true);
    try {
      _shotId = await ref.read(repoProvider).upload('proof', await x.readAsBytes(), 'image/jpeg');
    } catch (e) {
      if (mounted) toast(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  Future<void> _submit() async {
    final l = L.of(context);
    if (!RegExp(r'^\d{12}$').hasMatch(_utr.text)) return setState(() => _error = l.utrInvalid);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final p = await ref.read(repoProvider).submitProof(widget.payment.id, _utr.text, _shotId);
      ref.invalidate(paymentsProvider);
      if (mounted) context.pushReplacement('/payment/${p.id}');
    } on ApiException catch (e) {
      setState(() => _error = e.code == 'UTR_USED' ? l.utrUsed : errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l.utrTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        CardBox(
          child: Row(children: [
            Expanded(child: Text(widget.payment.planName ?? l.boost, style: T.strong)),
            Text(rupees(widget.payment.amountPaise), style: T.price),
          ]),
        ),
        const SizedBox(height: S.s4),
        TextField(
          controller: _utr,
          autofocus: true,
          keyboardType: TextInputType.number,
          maxLength: 12,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: T.h3.copyWith(letterSpacing: 2, fontFeatures: const [FontFeature.tabularFigures()]),
          onChanged: (_) => setState(() => _error = null),
          decoration: InputDecoration(labelText: l.utrLabel, errorText: _error, counterText: ''),
        ),
        const SizedBox(height: S.s2),
        Container(
          padding: const EdgeInsets.all(S.s3),
          decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.input)),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(PhosphorIconsRegular.info, color: C.primary, size: 20),
            const SizedBox(width: S.s2),
            Expanded(child: Text(l.utrHelp, style: T.secondary.copyWith(color: C.ink))),
          ]),
        ),
        const SizedBox(height: S.s4),
        Btn(_shotId != null ? l.screenshotAttached : l.attachScreenshot, kind: BtnKind.secondary, loading: _uploading, icon: _shotId != null ? PhosphorIconsRegular.check : PhosphorIconsRegular.paperclip, onPressed: _pickShot),
        const SizedBox(height: S.s5),
        Btn(l.submit, loading: _busy, onPressed: _utr.text.length == 12 && !_uploading ? _submit : null),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-19 Payment status

class PaymentStatusScreen extends ConsumerWidget {
  const PaymentStatusScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final p = ref.watch(paymentProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(l.paymentStatusTitle)),
      body: p.when(
        loading: () => const ListSkeleton(rows: 3),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(paymentProvider(id))),
        data: (pay) {
          final approved = pay.status == 'APPROVED', rejected = pay.status == 'REJECTED';
          Widget step(String text, bool done, {bool bad = false, bool last = false, String? sub}) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Column(children: [
                  Icon(bad ? PhosphorIconsFill.xCircle : done ? PhosphorIconsFill.checkCircle : PhosphorIconsRegular.circle, color: bad ? C.danger : done ? C.primary : C.ink2),
                  if (!last) Container(width: 2, height: 36, color: done ? C.primary : C.line),
                ]),
                const SizedBox(width: S.s3),
                Expanded(child: Padding(padding: const EdgeInsets.only(top: 2), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(text, style: T.strong), if (sub != null) Text(sub, style: T.secondary)]))),
              ]);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(paymentProvider(id).future),
            child: ListView(padding: const EdgeInsets.all(S.screen), children: [
              CardBox(
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(pay.planName ?? l.boost, style: T.strong), Text(pay.reference, style: T.secondary)])),
                  Text(rupees(pay.amountPaise), style: T.price),
                ]),
              ),
              const SizedBox(height: S.s5),
              step(l.stepSubmitted, pay.submittedAt != null),
              step(l.stepChecking, approved || rejected, sub: approved || rejected ? null : l.checkingNote),
              rejected ? step(l.stepRejected, false, bad: true, last: true, sub: pay.rejectReason) : step(l.stepApproved, approved, last: true),
              const SizedBox(height: S.s5),
              if (rejected) Btn(l.submitAgain, onPressed: () => context.pushReplacement('/utr', extra: pay)),
              if (approved) Btn(l.navMyItems, kind: BtnKind.secondary, onPressed: () => context.go('/my-items')),
            ]),
          );
        },
      ),
    );
  }
}

class MyPaymentsScreen extends ConsumerWidget {
  const MyPaymentsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final list = ref.watch(paymentsProvider);
    final locale = Localizations.localeOf(context).languageCode;
    return Scaffold(
      appBar: AppBar(title: Text(l.myPayments)),
      body: list.when(
        loading: () => const ListSkeleton(rows: 4),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(paymentsProvider)),
        data: (items) => items.isEmpty
            ? EmptyState(icon: PhosphorIconsRegular.receipt, text: l.plansSoon)
            : ListView.separated(
                padding: const EdgeInsets.all(S.screen),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: S.s2),
                itemBuilder: (_, i) {
                  final p = items[i];
                  return CardBox(
                    onTap: () => p.status == 'CREATED' ? context.push('/pay', extra: p) : context.push('/payment/${p.id}'),
                    child: Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(p.planName ?? l.boost, style: T.strong), Text('${p.reference} · ${shortDate(p.createdAt, locale)}', style: T.secondary)])),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [Text(rupees(p.amountPaise), style: T.price), const SizedBox(height: S.s1), StatusPill(p.status)]),
                    ]),
                  );
                },
              ),
      ),
    );
  }
}
