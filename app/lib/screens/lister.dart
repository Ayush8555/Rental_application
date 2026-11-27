import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../theme/icons.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/format.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import '../widgets/common.dart';
import '../widgets/item_card.dart';
import 'account.dart' show maybeAskForPush;

// ---------------------------------------------------------------- A-14 Add / edit item

class _PhotoSlot {
  _PhotoSlot.remote(this.id, this.url) : bytes = null, state = _Up.done;
  _PhotoSlot.local(this.bytes) : id = null, url = null, state = _Up.uploading;
  String? id; // upload id (new) or image id (existing)
  final String? url;
  final Uint8List? bytes;
  _Up state;
  double progress = 0;
}

enum _Up { uploading, done, failed }

class EditItemScreen extends ConsumerStatefulWidget {
  const EditItemScreen({super.key, this.existing});
  final OwnListing? existing;
  @override
  ConsumerState<EditItemScreen> createState() => _EditItemState();
}

class _EditItemState extends ConsumerState<EditItemScreen> {
  final _form = GlobalKey<FormState>();
  late final OwnListing? e = widget.existing;
  late final _title = TextEditingController(text: e?.title ?? '');
  late final _desc = TextEditingController(text: e?.description ?? '');
  late final _day = TextEditingController(text: _r(e?.rentDay));
  late final _week = TextEditingController(text: _r(e?.rentWeek));
  late final _month = TextEditingController(text: _r(e?.rentMonth));
  late final _deposit = TextEditingController(text: _r(e?.deposit));
  final _whatsapp = TextEditingController();
  late String? _categoryId = e?.categoryId;
  late String? _areaId = e?.areaId;
  late String _condition = e?.condition.isNotEmpty == true ? e!.condition : 'GOOD';
  late final Map<String, TextEditingController> _extra = {};
  late final List<_PhotoSlot> _photos = [for (final i in e?.images ?? const <({String id, String url})>[]) _PhotoSlot.remote(i.id, i.url)];
  bool _dirty = false, _saving = false;
  String? _error;

  static String _r(int? p) => p == null ? '' : '${p ~/ 100}';

  @override
  void initState() {
    super.initState();
    for (final c in [_title, _desc, _day, _week, _month, _deposit, _whatsapp]) {
      c.addListener(() => _dirty = true);
    }
  }

  Future<void> _addPhoto(ImageSource src) async {
    final l = L.of(context);
    // image_picker re-encodes to JPEG at this size, so uploads stay small on 3G.
    final picked = src == ImageSource.camera
        ? [?await ImagePicker().pickImage(source: src, maxWidth: 1600, maxHeight: 1600, imageQuality: 82)]
        : await ImagePicker().pickMultiImage(maxWidth: 1600, maxHeight: 1600, imageQuality: 82, limit: 8 - _photos.length);
    for (final x in picked.take(8 - _photos.length)) {
      final slot = _PhotoSlot.local(await x.readAsBytes());
      setState(() {
        _photos.add(slot);
        _dirty = true;
      });
      unawaited(_upload(slot, l));
    }
  }

  Future<void> _upload(_PhotoSlot s, L l) async {
    setState(() => s.state = _Up.uploading);
    try {
      s.id = await ref.read(repoProvider).upload('listing', s.bytes!, 'image/jpeg', onProgress: (p) => mounted ? setState(() => s.progress = p) : null);
      if (mounted) setState(() => s.state = _Up.done);
    } catch (err) {
      if (mounted) {
        setState(() => s.state = _Up.failed);
        toast(context, '${l.uploadFailed}: ${errorText(l, err)}');
      }
    }
  }

  int? _rupees(TextEditingController c) => c.text.isEmpty ? null : int.tryParse(c.text);

  Future<void> _save({required bool submit}) async {
    final l = L.of(context);
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;
    if (_day.text.isEmpty && _week.text.isEmpty && _month.text.isEmpty) return setState(() => _error = l.atLeastOneRent);
    if (_photos.any((p) => p.state == _Up.uploading)) return;
    final images = _photos.where((p) => p.state == _Up.done && p.id != null).map((p) => p.id!).toList();
    if (submit && images.isEmpty) return setState(() => _error = l.needPhoto);
    setState(() => _saving = true);
    final body = <String, dynamic>{
      'title': _title.text.trim(),
      'description': _desc.text.trim(),
      'categoryId': _categoryId,
      'areaId': _areaId,
      'rentDay': _rupees(_day),
      'rentWeek': _rupees(_week),
      'rentMonth': _rupees(_month),
      'deposit': _rupees(_deposit),
      'condition': _condition,
      'imageIds': images,
      'extra': {for (final x in _extra.entries) if (x.value.text.trim().isNotEmpty) x.key: num.tryParse(x.value.text.trim()) ?? x.value.text.trim()},
      if (_whatsapp.text.isNotEmpty) 'whatsappPhone': _whatsapp.text,
    };
    try {
      final repo = ref.read(repoProvider);
      Json r;
      if (e == null) {
        r = await repo.createListing({...body, 'submit': submit});
      } else {
        r = await repo.updateListing(e!.id, body);
        if (submit && (e!.status == 'DRAFT' || e!.status == 'HIDDEN')) r = await repo.listingStatus(e!.id, 'submit');
      }
      ref.invalidate(myListingsProvider);
      ref.invalidate(listerSummaryProvider);
      await ref.read(sessionProvider.notifier).refreshMe();
      if (!mounted) return;
      if ((r['warnings'] as List?)?.contains('CONTACT_REMOVED') ?? false) toast(context, l.contactRemoved);
      final status = (r['listing'] as Json)['status'];
      final msg = r['message'] as String?;
      _dirty = false;
      // First listing is a good moment to ask about notifications.
      if (e == null) await maybeAskForPush(context, ref);
      if (!mounted) return;
      context.pop();
      if (msg != null) {
        toast(context, msg);
      } else if (status == 'LIVE') {
        toast(context, l.itemLive);
      }
    } on ApiException catch (err) {
      setState(() => _error = err.fields.isNotEmpty ? err.fields.values.first : errorText(l, err));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<bool> _confirmLeave() async {
    if (!_dirty) return true;
    final l = L.of(context);
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(l.discardTitle),
            content: Text(l.discardBody),
            actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.stay)), TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.leave))],
          ),
        ) ??
        false;
  }

  String? _priceCheck(String? v) {
    if (v == null || v.isEmpty) return null;
    final n = int.tryParse(v);
    return n == null || n < 1 || n > 1000000 ? L.of(context).priceRangeError : null;
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final cityId = ref.watch(currentCityIdProvider);
    final cats = ref.watch(categoriesProvider).value ?? const <Category>[];
    final areas = cityId == null ? const <Area>[] : ref.watch(areasProvider(cityId)).value ?? const <Area>[];
    final cat = cats.where((c) => c.id == _categoryId).firstOrNull;
    final digits = [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(7)];
    const gap = SizedBox(height: S.s4);

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmLeave() && context.mounted) {
          _dirty = false;
          context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(title: Text(e == null ? l.addItemTitle : l.editItemTitle)),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(S.screen), children: [
            Text(l.photos, style: T.h3),
            Text(l.photosHelp, style: T.secondary),
            const SizedBox(height: S.s2),
            SizedBox(
              height: 92,
              child: ReorderableListView(
                scrollDirection: Axis.horizontal,
                buildDefaultDragHandles: false,
                onReorderItem: (a, b) => setState(() {
                  _photos.insert(b, _photos.removeAt(a));
                  _dirty = true;
                }),
                footer: _photos.length >= 8
                    ? null
                    : Padding(
                        padding: const EdgeInsets.only(left: S.s2),
                        child: _AddPhotoTile(onPick: _addPhoto),
                      ),
                children: [
                  for (final (i, p) in _photos.indexed)
                    ReorderableDelayedDragStartListener(
                      key: ObjectKey(p),
                      index: i,
                      child: Padding(padding: const EdgeInsets.only(right: S.s2), child: _PhotoTile(p, onRemove: () => setState(() => _photos.remove(p)), onRetry: () => _upload(p, l))),
                    ),
                ],
              ),
            ),
            gap,
            TextFormField(
              controller: _title,
              maxLength: 80,
              decoration: InputDecoration(labelText: l.title, hintText: l.titleHint),
              validator: (v) => (v ?? '').trim().length < 8 ? l.titleLength : null,
            ),
            DropdownButtonFormField<String>(
              initialValue: _categoryId,
              decoration: InputDecoration(labelText: l.category),
              items: [for (final c in cats) DropdownMenuItem(value: c.id, child: Text(c.label(hindi)))],
              onChanged: (v) => setState(() {
                _categoryId = v;
                _dirty = true;
              }),
              validator: (v) => v == null ? l.category : null,
            ),
            for (final f in cat?.fields ?? const <ExtraField>[]) ...[
              gap,
              Builder(builder: (_) {
                final c = _extra.putIfAbsent(f.key, () => TextEditingController(text: '${e?.extra[f.key] ?? ''}'));
                final label = hindi && f.labelHi != null ? f.labelHi! : f.label;
                if (f.type == 'select') {
                  return DropdownButtonFormField<String>(
                    initialValue: f.options.contains(c.text) ? c.text : null,
                    decoration: InputDecoration(labelText: label),
                    items: [for (final o in f.options) DropdownMenuItem(value: o, child: Text(o))],
                    onChanged: (v) => c.text = v ?? '',
                    validator: (v) => f.required && v == null ? label : null,
                  );
                }
                return TextFormField(
                  controller: c,
                  maxLength: 60,
                  keyboardType: f.type == 'number' ? TextInputType.number : TextInputType.text,
                  decoration: InputDecoration(labelText: label, counterText: ''),
                  validator: (v) => f.required && (v ?? '').trim().isEmpty ? label : null,
                );
              }),
            ],
            gap,
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: TextFormField(controller: _day, keyboardType: TextInputType.number, inputFormatters: digits, decoration: InputDecoration(labelText: l.rentPerDay), validator: _priceCheck)),
              const SizedBox(width: S.s3),
              Expanded(child: TextFormField(controller: _week, keyboardType: TextInputType.number, inputFormatters: digits, decoration: InputDecoration(labelText: l.rentPerWeek), validator: _priceCheck)),
            ]),
            gap,
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: TextFormField(controller: _month, keyboardType: TextInputType.number, inputFormatters: digits, decoration: InputDecoration(labelText: l.rentPerMonth), validator: _priceCheck)),
              const SizedBox(width: S.s3),
              Expanded(child: TextFormField(controller: _deposit, keyboardType: TextInputType.number, inputFormatters: digits, decoration: InputDecoration(labelText: l.depositOptional), validator: _priceCheck)),
            ]),
            gap,
            Text(l.condition, style: T.label),
            const SizedBox(height: S.s1),
            Wrap(spacing: S.s2, runSpacing: S.s2, children: [
              for (final (v, t) in [('NEW', l.condNEW), ('LIKE_NEW', l.condLIKE_NEW), ('GOOD', l.condGOOD), ('FAIR', l.condFAIR)])
                ChoiceChip(label: Text(t), selected: _condition == v, onSelected: (_) => setState(() => _condition = v)),
            ]),
            gap,
            DropdownButtonFormField<String>(
              initialValue: _areaId,
              decoration: InputDecoration(labelText: l.area),
              items: [for (final a in areas) DropdownMenuItem(value: a.id, child: Text(a.name))],
              onChanged: (v) => setState(() => _areaId = v),
              validator: (v) => v == null ? l.area : null,
            ),
            gap,
            TextFormField(
              controller: _whatsapp,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              decoration: InputDecoration(labelText: l.whatsappNumber, prefixText: '+91 ', hintText: e?.whatsappMasked, helperText: l.whatsappHelp),
              validator: (v) => (v ?? '').isEmpty || RegExp(r'^[6-9]\d{9}$').hasMatch(v!) ? null : l.invalidMobile,
            ),
            gap,
            TextFormField(
              controller: _desc,
              maxLength: 1000,
              minLines: 4,
              maxLines: 8,
              decoration: InputDecoration(labelText: l.description, hintText: l.descriptionHint, alignLabelWithHint: true),
              validator: (v) => (v ?? '').trim().length < 20 ? l.descLength : null,
            ),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: S.s2), child: Text(_error!, style: T.secondary.copyWith(color: C.danger))),
            const SizedBox(height: S.s5),
            Row(children: [
              Expanded(child: Btn(l.saveDraft, kind: BtnKind.secondary, onPressed: _saving ? null : () => _save(submit: false))),
              const SizedBox(width: S.s3),
              Expanded(child: Btn(l.submit, loading: _saving, onPressed: () => _save(submit: true))),
            ]),
            const SizedBox(height: S.s6),
          ]),
        ),
      ),
    );
  }
}

class _AddPhotoTile extends StatelessWidget {
  const _AddPhotoTile({required this.onPick});
  final void Function(ImageSource) onPick;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return Semantics(
      button: true,
      label: l.addPhoto,
      child: InkWell(
        borderRadius: BorderRadius.circular(R.input),
        onTap: () => showModalBottomSheet<void>(
          context: context,
          builder: (ctx) => SafeArea(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              ListTile(leading: const Icon(PhosphorIconsRegular.camera), title: Text(l.camera), onTap: () {
                Navigator.pop(ctx);
                onPick(ImageSource.camera);
              }),
              ListTile(leading: const Icon(PhosphorIconsRegular.images), title: Text(l.gallery), onTap: () {
                Navigator.pop(ctx);
                onPick(ImageSource.gallery);
              }),
            ]),
          ),
        ),
        child: Container(
          width: 92,
          height: 92,
          decoration: BoxDecoration(color: C.primarySoft, borderRadius: BorderRadius.circular(R.input), border: Border.all(color: C.primary)),
          child: const Icon(PhosphorIconsRegular.plus, color: C.primary),
        ),
      ),
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile(this.p, {required this.onRemove, required this.onRetry});
  final _PhotoSlot p;
  final VoidCallback onRemove, onRetry;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final img = p.bytes != null ? Image.memory(p.bytes!, fit: BoxFit.cover, width: 92, height: 92) : Image.network(p.url!, fit: BoxFit.cover, width: 92, height: 92);
    return SizedBox(
      width: 92,
      height: 92,
      child: Stack(children: [
        ClipRRect(borderRadius: BorderRadius.circular(R.input), child: img),
        if (p.state == _Up.uploading)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(color: C.ink.withValues(alpha: 0.45), borderRadius: BorderRadius.circular(R.input)),
              alignment: Alignment.center,
              child: CircularProgressIndicator(value: p.progress > 0 ? p.progress : null, color: C.surface, strokeWidth: 3),
            ),
          ),
        if (p.state == _Up.failed)
          Positioned.fill(
            child: Material(
              color: C.danger.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(R.input),
              child: InkWell(onTap: onRetry, child: Center(child: Text(l.retry, style: T.label.copyWith(color: C.surface)))),
            ),
          ),
        Positioned(
          top: 2,
          right: 2,
          child: Material(
            color: C.surface,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onRemove,
              child: Semantics(label: l.remove, child: const Padding(padding: EdgeInsets.all(4), child: Icon(PhosphorIconsBold.x, size: 14))),
            ),
          ),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-15 / A-20 My items + lister dashboard

class MyItemsScreen extends ConsumerWidget {
  const MyItemsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final items = ref.watch(myListingsProvider);
    final summary = ref.watch(listerSummaryProvider);
    Future<void> refresh() async {
      ref.invalidate(listerSummaryProvider);
      final _ = await ref.refresh(myListingsProvider.future);
    }

    return Scaffold(
      appBar: AppBar(title: Text(l.navMyItems), actions: [
        IconButton(tooltip: l.putOnRent, icon: const Icon(PhosphorIconsRegular.plus), onPressed: () => context.push('/add-item')),
      ]),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(padding: const EdgeInsets.all(S.screen), children: [
          summary.when(
            loading: () => const Skeleton(height: 140, radius: R.card),
            error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(listerSummaryProvider)),
            data: (s) => _PlanCard(s),
          ),
          const SizedBox(height: S.s4),
          items.when(
            loading: () => const SizedBox(height: 400, child: ListSkeleton(rows: 3)),
            error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(myListingsProvider)),
            data: (p) => p.items.isEmpty
                ? EmptyState(icon: PhosphorIconsRegular.package, text: l.myItemsEmpty, action: l.putOnRent, onAction: () => context.push('/add-item'))
                : Column(children: [
                    if (p.items.any((i) => i.hiddenReason == 'OVER_LIMIT' || i.hiddenReason == 'LIMIT_REACHED'))
                      Padding(padding: const EdgeInsets.only(bottom: S.s3), child: Text(l.overLimit, style: T.secondary.copyWith(color: C.warning))),
                    for (final i in p.items) Padding(padding: const EdgeInsets.only(bottom: S.s3), child: _OwnItem(i)),
                  ]),
          ),
        ]),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: C.primary,
        foregroundColor: C.surface,
        onPressed: () => context.push('/add-item'),
        icon: const Icon(PhosphorIconsRegular.plus),
        label: Text(l.putOnRent),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard(this.s);
  final Json s;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final plan = s['plan'] as Json?;
    Widget stat(String label, String value) => Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: T.priceLarge),
            Text(label, style: T.secondary),
          ]),
        );
    final limit = s['limit'] as num?;
    return CardBox(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (plan == null) ...[
          Text(l.noPlanTitle, style: T.h3),
          const SizedBox(height: S.s1),
          Text(l.noPlanBody, style: T.secondary),
          const SizedBox(height: S.s3),
          Btn(l.choosePlan, onPressed: () => context.push('/plans')),
        ] else ...[
          Row(children: [
            Expanded(child: Text(plan['planName'] as String, style: T.h3)),
            Text(l.daysLeft((plan['daysLeft'] as num).toInt()), style: T.strong.copyWith(color: (plan['daysLeft'] as num) <= 7 ? C.accent : C.primary)),
          ]),
          const SizedBox(height: S.s3),
          Row(children: [
            stat(l.views, '${s['views']}'),
            stat(l.whatsappChats, '${s['whatsappChats']}'),
            stat(l.itemsLive, limit == null ? '${s['liveCount']}' : '${s['liveCount']}/$limit'),
          ]),
          const SizedBox(height: S.s3),
          Row(children: [
            Expanded(child: Btn(l.renew, kind: BtnKind.secondary, onPressed: () => context.push('/plans'))),
            const SizedBox(width: S.s3),
            Expanded(child: Btn(l.upgrade, onPressed: () => context.push('/plans'))),
          ]),
        ],
        if ((s['pendingPayments'] as num? ?? 0) > 0)
          TextButton(onPressed: () => context.push('/payments'), child: Text('${l.myPayments} · ${s['pendingPayments']} ${l.statusPENDING.toLowerCase()}')),
      ]),
    );
  }
}

class _OwnItem extends ConsumerWidget {
  const _OwnItem(this.i);
  final OwnListing i;

  Future<void> _act(BuildContext context, WidgetRef ref, String action) async {
    final l = L.of(context);
    try {
      final r = await ref.read(repoProvider).listingStatus(i.id, action);
      ref.invalidate(myListingsProvider);
      ref.invalidate(listerSummaryProvider);
      final msg = r['message'] as String?;
      if (msg != null && context.mounted) toast(context, msg);
    } catch (e) {
      if (context.mounted) toast(context, errorText(l, e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final canGoLive = i.status == 'DRAFT' || (i.status == 'HIDDEN' && i.hiddenReason != 'PAUSED' && i.hiddenReason != 'ADMIN' && i.hiddenReason != 'REPORTS');
    return CardBox(
      padding: const EdgeInsets.all(S.s3),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 96, child: Photo(i.thumbnail, icon: categoryIcon(i.categoryIcon))),
          const SizedBox(width: S.s3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              StatusPill(i.status),
              const SizedBox(height: S.s1),
              Text(i.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: T.strong),
              Text(rentText(l, i), style: T.price.copyWith(fontSize: 14)),
              Text('${i.viewCount} ${l.views.toLowerCase()} · ${i.waClickCount} ${l.whatsappChats.toLowerCase()}', style: T.secondary),
              if (i.featuredUntil != null) Text(l.boostedTill(shortDate(i.featuredUntil!, Localizations.localeOf(context).languageCode)), style: T.label.copyWith(color: C.accent)),
              if (i.rejectReason != null && i.status != 'LIVE') Text(i.rejectReason!, style: T.label.copyWith(color: C.danger)),
            ]),
          ),
          PopupMenuButton<String>(
            tooltip: l.more,
            onSelected: (v) async {
              if (v == 'edit') return context.push('/edit-item', extra: i).then((_) => ref.invalidate(myListingsProvider));
              if (v == 'delete') {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text(l.deleteItemTitle),
                    content: Text(l.deleteItemBody),
                    actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l.cancel)), TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(l.delete, style: const TextStyle(color: C.danger)))],
                  ),
                );
                if (ok == true) {
                  await ref.read(repoProvider).deleteListing(i.id);
                  ref.invalidate(myListingsProvider);
                }
                return;
              }
              if (context.mounted) await _act(context, ref, v);
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'edit', child: Text(l.edit)),
              if (i.status == 'LIVE') PopupMenuItem(value: 'rented_out', child: Text(l.markRented)),
              if (i.status == 'RENTED_OUT' || (i.status == 'HIDDEN' && i.hiddenReason == 'PAUSED')) PopupMenuItem(value: 'available', child: Text(l.markAvailable)),
              if (i.status == 'LIVE' || i.status == 'RENTED_OUT') PopupMenuItem(value: 'pause', child: Text(l.pause)),
              PopupMenuItem(value: 'delete', child: Text(l.delete, style: const TextStyle(color: C.danger))),
            ],
          ),
        ]),
        if (i.status == 'LIVE' || canGoLive) ...[
          const SizedBox(height: S.s2),
          Row(children: [
            if (canGoLive) Expanded(child: Btn(l.goLive, kind: BtnKind.secondary, onPressed: () => _act(context, ref, 'submit'))),
            if (i.status == 'LIVE') ...[
              Expanded(child: Btn(l.boost, kind: BtnKind.secondary, icon: PhosphorIconsRegular.rocketLaunch, onPressed: () => context.push('/boost/${i.id}'))),
              const SizedBox(width: S.s2),
              Expanded(child: Btn(l.share, kind: BtnKind.secondary, icon: PhosphorIconsRegular.shareNetwork, onPressed: () => context.push('/share/${i.id}'))),
            ],
          ]),
        ],
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-21 Boost

class BoostScreen extends ConsumerStatefulWidget {
  const BoostScreen({super.key, required this.listingId});
  final String listingId;
  @override
  ConsumerState<BoostScreen> createState() => _BoostState();
}

class _BoostState extends ConsumerState<BoostScreen> {
  int? _days;
  bool _busy = false;

  Future<void> _go({required bool credit}) async {
    final l = L.of(context);
    if (_days == null) return;
    setState(() => _busy = true);
    try {
      final r = await ref.read(repoProvider).boost(widget.listingId, _days!, useCredit: credit);
      ref.invalidate(myListingsProvider);
      ref.invalidate(listerSummaryProvider);
      if (!mounted) return;
      final payment = r['payment'] as Json?;
      if (payment != null) {
        context.pushReplacement('/pay', extra: Payment.fromJson(payment));
      } else {
        toast(context, (r['boost'] as Json)['status'] == 'QUEUED' ? l.boostQueued : l.boostStarted);
        context.pop();
      }
    } catch (e) {
      if (mounted) toast(context, errorText(l, e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final settings = ref.watch(settingsProvider).value;
    final credits = ((ref.watch(listerSummaryProvider).value?['plan'] as Json?)?['boostCreditsLeft'] as num?)?.toInt() ?? 0;
    return Scaffold(
      appBar: AppBar(title: Text(l.boostTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        Text(l.boostBody, style: T.body15.copyWith(color: C.ink2)),
        const SizedBox(height: S.s4),
        for (final o in settings?.boostOptions ?? const <({int days, int pricePaise})>[])
          Padding(
            padding: const EdgeInsets.only(bottom: S.s2),
            child: CardBox(
              onTap: () => setState(() => _days = o.days),
              child: Row(children: [
                Icon(_days == o.days ? PhosphorIconsFill.radioButton : PhosphorIconsRegular.circle, color: _days == o.days ? C.primary : C.ink2),
                const SizedBox(width: S.s3),
                Expanded(child: Text(l.boostDays(o.days), style: T.strong)),
                Text(rupees(o.pricePaise), style: T.price),
              ]),
            ),
          ),
        const SizedBox(height: S.s4),
        if (credits > 0) ...[
          Btn(l.useCredit(credits), kind: BtnKind.secondary, onPressed: _days == null || _busy ? null : () => _go(credit: true)),
          const SizedBox(height: S.s2),
        ],
        Btn(
          _days == null ? l.boost : l.payViaUpi(rupees(settings!.boostOptions.firstWhere((o) => o.days == _days).pricePaise)),
          loading: _busy,
          onPressed: _days == null ? null : () => _go(credit: false),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-28 Share card

class ShareCardScreen extends ConsumerWidget {
  const ShareCardScreen({super.key, required this.listingId});
  final String listingId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final card = ref.watch(_shareCardProvider(listingId));
    return Scaffold(
      appBar: AppBar(title: Text(l.shareCardTitle)),
      body: card.when(
        loading: () => const Padding(padding: EdgeInsets.all(S.screen), child: Skeleton(height: 420, radius: R.card)),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(_shareCardProvider(listingId))),
        data: (c) => ListView(padding: const EdgeInsets.all(S.screen), children: [
          Photo(c['imageUrl'] as String, ratio: 1080 / 1350, radius: R.card),
          const SizedBox(height: S.s4),
          Btn(l.whatsappStatus, kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, onPressed: () => launchUrl(Uri.parse('whatsapp://send?text=${Uri.encodeComponent(c['text'] as String)}'), mode: LaunchMode.externalApplication)),
          const SizedBox(height: S.s2),
          Row(children: [
            Expanded(
              child: Btn(l.copyLink, kind: BtnKind.secondary, icon: PhosphorIconsRegular.link, onPressed: () async {
                // Copied only when the person taps; never automatically.
                await Clipboard.setData(ClipboardData(text: c['link'] as String));
                if (context.mounted) toast(context, l.linkCopied);
              }),
            ),
            const SizedBox(width: S.s2),
            Expanded(child: Btn(l.more, kind: BtnKind.secondary, icon: PhosphorIconsRegular.shareNetwork, onPressed: () => SharePlus.instance.share(ShareParams(text: c['text'] as String)))),
          ]),
        ]),
      ),
    );
  }
}

final _shareCardProvider = FutureProvider.family<Json, String>((ref, id) => ref.watch(repoProvider).shareCard(id));
