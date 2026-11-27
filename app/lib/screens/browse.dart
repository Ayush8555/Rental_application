import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
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
import '../widgets/sign_in_sheet.dart';

// ---------------------------------------------------------------- A-07 App shell

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final session = ref.watch(sessionProvider);
    final lister = session.me?.isLister ?? false;
    // Branches: 0 home, 1 search, 2 my items, 3 saved, 4 profile
    final branches = [0, 1, if (lister) 2, 3, 4];
    final index = branches.indexOf(shell.currentIndex).clamp(0, branches.length - 1);
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) {
          final b = branches[i];
          if ((b == 3 || b == 2) && !session.signedIn) return unawaited(showSignInSheet(context));
          shell.goBranch(b, initialLocation: b == shell.currentIndex);
        },
        destinations: [
          NavigationDestination(icon: const Icon(PhosphorIconsRegular.house), selectedIcon: const Icon(PhosphorIconsFill.house, color: C.primary), label: l.navHome),
          NavigationDestination(icon: const Icon(PhosphorIconsRegular.magnifyingGlass), selectedIcon: const Icon(PhosphorIconsBold.magnifyingGlass, color: C.primary), label: l.navSearch),
          if (lister) NavigationDestination(icon: const Icon(PhosphorIconsRegular.package), selectedIcon: const Icon(PhosphorIconsFill.package, color: C.primary), label: l.navMyItems),
          NavigationDestination(icon: const Icon(PhosphorIconsRegular.heart), selectedIcon: const Icon(PhosphorIconsFill.heart, color: C.primary), label: l.navSaved),
          NavigationDestination(icon: const Icon(PhosphorIconsRegular.user), selectedIcon: const Icon(PhosphorIconsFill.user, color: C.primary), label: l.navProfile),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- A-08 Home

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});
  @override
  ConsumerState<HomeScreen> createState() => _HomeState();
}

class _HomeState extends ConsumerState<HomeScreen> {
  final _items = <ListingCard>[];
  String? _next;
  bool _loading = true, _more = false, _offline = false;
  Object? _error;
  String? _cityId;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 600) unawaited(_loadMore());
    });
  }

  Future<void> _load() async {
    final city = ref.read(currentCityIdProvider);
    if (city == null) return;
    setState(() {
      _loading = _items.isEmpty;
      _error = null;
    });
    try {
      final p = await ref.read(repoProvider).search({'city': city, 'sort': 'newest', 'limit': 20});
      ref.read(savedIdsProvider.notifier).seed(p.items);
      ref.invalidate(featuredProvider(city));
      setState(() {
        _items
          ..clear()
          ..addAll(p.items);
        _next = p.next;
        _offline = false;
      });
    } catch (e) {
      setState(() {
        _error = _items.isEmpty ? e : null;
        _offline = e is ApiException && e.kind == ApiErrorKind.offline;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    final city = ref.read(currentCityIdProvider);
    if (_more || _next == null || city == null) return;
    _more = true;
    try {
      final p = await ref.read(repoProvider).search({'city': city, 'sort': 'newest', 'limit': 20, 'cursor': _next});
      ref.read(savedIdsProvider.notifier).seed(p.items);
      setState(() {
        _items.addAll(p.items);
        _next = p.next;
      });
    } catch (_) {
    } finally {
      _more = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final cityId = ref.watch(currentCityIdProvider);
    if (cityId != _cityId) {
      _cityId = cityId;
      _items.clear();
      scheduleMicrotask(_load);
    }
    final city = ref.watch(citiesProvider).value?.where((c) => c.id == cityId).firstOrNull;
    final cats = ref.watch(categoriesProvider);
    final featured = cityId == null ? null : ref.watch(featuredProvider(cityId));
    final unread = ref.watch(sessionProvider).signedIn ? ref.watch(notificationsProvider).value?.unread ?? 0 : 0;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: S.screen,
        title: InkWell(
          onTap: () => context.push('/choose-city'),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(PhosphorIconsRegular.mapPin, size: 20, color: C.primary),
            const SizedBox(width: S.s1),
            Flexible(child: Text(city?.label(hindi) ?? l.chooseCity, style: T.h2, overflow: TextOverflow.ellipsis)),
            const Icon(PhosphorIconsRegular.caretDown, size: 16),
          ]),
        ),
        actions: [
          IconButton(
            tooltip: l.notificationsTitle,
            onPressed: () => ref.read(sessionProvider).signedIn ? context.push('/notifications') : showSignInSheet(context),
            icon: Badge(isLabelVisible: unread > 0, backgroundColor: C.accent, label: Text('$unread'), child: const Icon(PhosphorIconsRegular.bell)),
          ),
          const SizedBox(width: S.s1),
        ],
      ),
      body: cityId == null
          ? EmptyState(icon: PhosphorIconsRegular.mapPin, text: l.chooseCity, action: l.chooseCity, onAction: () => context.push('/choose-city'))
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(controller: _scroll, slivers: [
                if (_offline) const SliverToBoxAdapter(child: OfflineBanner()),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(S.screen, S.s3, S.screen, 0),
                    child: CardBox(
                      padding: const EdgeInsets.symmetric(horizontal: S.s3, vertical: S.s3),
                      onTap: () => StatefulNavigationShell.maybeOf(context)?.goBranch(1),
                      child: Row(children: [
                        const Icon(PhosphorIconsRegular.magnifyingGlass, color: C.ink2),
                        const SizedBox(width: S.s3),
                        Expanded(child: Text(l.searchHint, style: T.body15.copyWith(color: C.ink2), overflow: TextOverflow.ellipsis)),
                      ]),
                    ),
                  ),
                ),
                SliverToBoxAdapter(child: SectionTitle(l.categories)),
                SliverToBoxAdapter(
                  child: cats.when(
                    loading: () => const Padding(padding: EdgeInsets.symmetric(horizontal: S.screen), child: Skeleton(height: 80)),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (list) => _CategoryGrid(list.take(8).toList()),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(S.screen, S.s4, S.screen, 0),
                    child: CardBox(
                      onTap: () => ref.read(sessionProvider).signedIn ? context.push('/request') : showSignInSheet(context, returnTo: '/request'),
                      child: Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(l.requestBannerTitle, style: T.strong),
                            Text(l.requestBannerBody, style: T.secondary),
                          ]),
                        ),
                        const Icon(PhosphorIconsRegular.megaphoneSimple, color: C.primary),
                      ]),
                    ),
                  ),
                ),
                if ((featured?.value ?? const []).isNotEmpty) ...[
                  SliverToBoxAdapter(child: SectionTitle(l.sponsored)),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 236,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: S.screen),
                        itemCount: featured!.value!.length,
                        separatorBuilder: (_, _) => const SizedBox(width: S.s3),
                        itemBuilder: (_, i) => SponsoredCard(featured.value![i]),
                      ),
                    ),
                  ),
                ],
                SliverToBoxAdapter(child: SectionTitle(l.latestIn(city?.label(hindi) ?? ''))),
                if (_loading)
                  const SliverToBoxAdapter(child: SizedBox(height: 520, child: ListSkeleton(rows: 4)))
                else if (_error != null)
                  SliverToBoxAdapter(child: ErrorRetry(error: _error!, onRetry: _load))
                else if (_items.isEmpty)
                  SliverToBoxAdapter(child: EmptyState(icon: PhosphorIconsRegular.package, text: l.emptyCity, action: l.putOnRent, onAction: () => context.push('/add-item')))
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s6),
                    sliver: SliverList.separated(
                      itemCount: _items.length,
                      separatorBuilder: (_, _) => const SizedBox(height: S.s3),
                      itemBuilder: (_, i) => ItemCard(_items[i]),
                    ),
                  ),
              ]),
            ),
    );
  }
}

class _CategoryGrid extends ConsumerWidget {
  const _CategoryGrid(this.cats);
  final List<Category> cats;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hindi = ref.watch(hindiProvider);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: S.screen),
      child: GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: S.s2,
        crossAxisSpacing: S.s2,
        childAspectRatio: 0.9,
        children: [
          for (final c in cats)
            CardBox(
              padding: const EdgeInsets.all(S.s2),
              onTap: () => context.push('/search?category=${c.id}'),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(categoryIcon(c.icon), color: C.primary, size: 26),
                const SizedBox(height: S.s1),
                Text(c.label(hindi), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: T.label.copyWith(color: C.ink)),
              ]),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------- A-09 Search and filters (+ A-30 Near me)

class Filters {
  const Filters({this.category, this.area, this.min, this.max, this.period, this.verified = false, this.sort = 'newest', this.lat, this.lng});
  final String? category, area, period;
  final int? min, max;
  final bool verified;
  final String sort;
  final double? lat, lng;
  Filters copy({String? category, String? area, int? min, int? max, String? period, bool? verified, String? sort, double? lat, double? lng, bool clear = false}) => Filters(
        category: clear ? null : category ?? this.category,
        area: clear ? null : area ?? this.area,
        min: clear ? null : min ?? this.min,
        max: clear ? null : max ?? this.max,
        period: clear ? null : period ?? this.period,
        verified: clear ? false : verified ?? this.verified,
        sort: sort ?? this.sort,
        lat: lat ?? this.lat,
        lng: lng ?? this.lng,
      );
  int get active => [area, min, max, period].where((v) => v != null).length + (verified ? 1 : 0);
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialCategory});
  final String? initialCategory;
  @override
  ConsumerState<SearchScreen> createState() => _SearchState();
}

class _SearchState extends ConsumerState<SearchScreen> {
  final _q = TextEditingController();
  late Filters _f = Filters(category: widget.initialCategory);
  Timer? _debounce;
  final _items = <ListingCard>[];
  int? _total;
  String? _next;
  bool _loading = false;
  Object? _error;
  int _seq = 0;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(_search);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  Map<String, dynamic> _query({String? cursor}) => {
        'city': ref.read(currentCityIdProvider),
        'q': _q.text.trim(),
        'category': _f.category,
        'area': _f.area,
        'min': _f.min,
        'max': _f.max,
        'period': _f.period,
        'verified': _f.verified ? 'true' : null,
        'sort': _f.sort,
        'lat': _f.lat,
        'lng': _f.lng,
        'cursor': cursor,
        'limit': 20,
      };

  Future<void> _search() async {
    if (ref.read(currentCityIdProvider) == null) return;
    final seq = ++_seq;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final p = await ref.read(repoProvider).search(_query());
      if (seq != _seq || !mounted) return;
      ref.read(savedIdsProvider.notifier).seed(p.items);
      setState(() {
        _items
          ..clear()
          ..addAll(p.items);
        _total = p.total;
        _next = p.next;
      });
    } catch (e) {
      if (seq == _seq && mounted) setState(() => _error = e);
    } finally {
      if (seq == _seq && mounted) setState(() => _loading = false);
    }
  }

  Future<void> _more() async {
    if (_next == null || _loading) return;
    final cursor = _next;
    _next = null;
    try {
      final p = await ref.read(repoProvider).search(_query(cursor: cursor));
      ref.read(savedIdsProvider.notifier).seed(p.items);
      setState(() {
        _items.addAll(p.items);
        _next = p.next;
      });
    } catch (_) {}
  }

  void _typed(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), _search);
  }

  Future<void> _nearMe() async {
    final l = L.of(context);
    final ok = await showModalBottomSheet<bool>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s4),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.nearMeAskTitle, style: T.h2),
            const SizedBox(height: S.s2),
            Text(l.nearMeAskBody, style: T.body15.copyWith(color: C.ink2)),
            const SizedBox(height: S.s5),
            Btn(l.useMyLocation, icon: PhosphorIconsRegular.crosshair, onPressed: () => Navigator.pop(ctx, true)),
            Btn(l.notNow, kind: BtnKind.text, onPressed: () => Navigator.pop(ctx, false)),
          ]),
        ),
      ),
    );
    Position? pos;
    if (ok == true) {
      try {
        var perm = await Geolocator.checkPermission();
        if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
        if (perm == LocationPermission.whileInUse || perm == LocationPermission.always) {
          pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 8)));
        }
      } catch (_) {}
    }
    if (!mounted) return;
    if (pos == null) toast(context, l.locationDenied);
    // The server rounds again to ~500 m; nothing is stored.
    setState(() => _f = _f.copy(sort: 'nearest', lat: pos?.latitude, lng: pos?.longitude));
    await _search();
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final hindi = ref.watch(hindiProvider);
    final cats = ref.watch(categoriesProvider).value ?? const <Category>[];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: S.screen,
        title: TextField(
          controller: _q,
          autofocus: widget.initialCategory == null,
          maxLength: 60,
          textInputAction: TextInputAction.search,
          onChanged: _typed,
          onSubmitted: (_) => _search(),
          decoration: InputDecoration(
            hintText: l.searchHint,
            counterText: '',
            isDense: true,
            prefixIcon: const Icon(PhosphorIconsRegular.magnifyingGlass, size: 20),
            suffixIcon: _q.text.isEmpty ? null : IconButton(tooltip: l.clear, icon: const Icon(PhosphorIconsRegular.x, size: 18), onPressed: () {
              _q.clear();
              unawaited(_search());
            }),
          ),
        ),
      ),
      body: Column(children: [
        SizedBox(
          height: 52,
          child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: S.screen, vertical: S.s2), children: [
            ActionChip(
              avatar: const Icon(PhosphorIconsRegular.slidersHorizontal, size: 16),
              label: Text(_f.active > 0 ? '${l.filters} · ${_f.active}' : l.filters),
              onPressed: () async {
                final f = await showModalBottomSheet<Filters>(context: context, isScrollControlled: true, builder: (_) => _FilterSheet(_f));
                if (f != null) {
                  setState(() => _f = f);
                  await _search();
                }
              },
            ),
            const SizedBox(width: S.s2),
            for (final c in cats) ...[
              ChoiceChip(
                label: Text(c.label(hindi)),
                selected: _f.category == c.id,
                onSelected: (v) {
                  setState(() => _f = Filters(category: v ? c.id : null, area: _f.area, min: _f.min, max: _f.max, period: _f.period, verified: _f.verified, sort: _f.sort, lat: _f.lat, lng: _f.lng));
                  unawaited(_search());
                },
              ),
              const SizedBox(width: S.s2),
            ],
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(S.screen, 0, S.s2, 0),
          child: Row(children: [
            Expanded(child: Text(_total == null ? '' : l.resultsCount(_total!), style: T.secondary)),
            PopupMenuButton<String>(
              initialValue: _f.sort,
              onSelected: (v) async {
                if (v == 'nearest') return _nearMe();
                setState(() => _f = _f.copy(sort: v));
                await _search();
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'nearest', child: Text(l.sortNearest)),
                PopupMenuItem(value: 'newest', child: Text(l.sortNewest)),
                PopupMenuItem(value: 'price', child: Text(l.sortPrice)),
              ],
              child: Padding(
                padding: const EdgeInsets.all(S.s3),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(switch (_f.sort) { 'nearest' => l.sortNearest, 'price' => l.sortPrice, _ => l.sortNewest }, style: T.secondary.copyWith(color: C.primary, fontWeight: FontWeight.w600)),
                  const Icon(PhosphorIconsRegular.caretDown, size: 14, color: C.primary),
                ]),
              ),
            ),
          ]),
        ),
        Expanded(
          child: _loading && _items.isEmpty
              ? const ListSkeleton()
              : _error != null
                  ? ErrorRetry(error: _error!, onRetry: _search)
                  : _items.isEmpty
                      ? ListView(children: [
                          EmptyState(
                            icon: PhosphorIconsRegular.magnifyingGlass,
                            text: '${l.noResultsTitle}. ${l.noResultsBody}',
                            action: l.requestThisItem,
                            onAction: () => ref.read(sessionProvider).signedIn
                                ? context.push('/request?text=${Uri.encodeComponent(_q.text.trim())}&category=${_f.category ?? ''}')
                                : showSignInSheet(context, returnTo: '/request'),
                          ),
                        ])
                      : NotificationListener<ScrollNotification>(
                          onNotification: (n) {
                            if (n.metrics.pixels > n.metrics.maxScrollExtent - 500) unawaited(_more());
                            return false;
                          },
                          child: ListView.separated(
                            padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s6),
                            itemCount: _items.length,
                            separatorBuilder: (_, _) => const SizedBox(height: S.s3),
                            itemBuilder: (_, i) => ItemCard(_items[i]),
                          ),
                        ),
        ),
      ]),
    );
  }
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet(this.f);
  final Filters f;
  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  late String? _area = widget.f.area, _period = widget.f.period;
  late bool _verified = widget.f.verified;
  late final _min = TextEditingController(text: widget.f.min?.toString() ?? '');
  late final _max = TextEditingController(text: widget.f.max?.toString() ?? '');

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final city = ref.watch(currentCityIdProvider);
    final areas = city == null ? const <Area>[] : ref.watch(areasProvider(city)).value ?? const <Area>[];
    return Padding(
      padding: EdgeInsets.fromLTRB(S.screen, 0, S.screen, MediaQuery.viewInsetsOf(context).bottom + S.s4),
      child: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.filters, style: T.h2),
          const SizedBox(height: S.s4),
          DropdownButtonFormField<String?>(
            initialValue: _area,
            decoration: InputDecoration(labelText: l.area),
            items: [DropdownMenuItem(value: null, child: Text(l.anyArea)), for (final a in areas) DropdownMenuItem(value: a.id, child: Text(a.name))],
            onChanged: (v) => setState(() => _area = v),
          ),
          const SizedBox(height: S.s4),
          Text(l.rentPeriod, style: T.label),
          const SizedBox(height: S.s1),
          Wrap(spacing: S.s2, children: [
            for (final (v, t) in [(null, l.any), ('day', l.day), ('week', l.week), ('month', l.month)])
              ChoiceChip(label: Text(t), selected: _period == v, onSelected: (_) => setState(() => _period = v)),
          ]),
          const SizedBox(height: S.s4),
          Text(l.priceRange, style: T.label),
          const SizedBox(height: S.s1),
          Row(children: [
            Expanded(child: TextField(controller: _min, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(7)], decoration: InputDecoration(hintText: l.min))),
            const SizedBox(width: S.s3),
            Expanded(child: TextField(controller: _max, keyboardType: TextInputType.number, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(7)], decoration: InputDecoration(hintText: l.max))),
          ]),
          const SizedBox(height: S.s2),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _verified, onChanged: (v) => setState(() => _verified = v), title: Text(l.verifiedOnly, style: T.body15)),
          const SizedBox(height: S.s3),
          Row(children: [
            Expanded(child: Btn(l.clear, kind: BtnKind.secondary, onPressed: () => Navigator.pop(context, widget.f.copy(clear: true)))),
            const SizedBox(width: S.s3),
            Expanded(
              child: Btn(l.apply, onPressed: () => Navigator.pop(
                    context,
                    Filters(category: widget.f.category, area: _area, period: _period, verified: _verified, min: int.tryParse(_min.text), max: int.tryParse(_max.text), sort: widget.f.sort, lat: widget.f.lat, lng: widget.f.lng),
                  )),
            ),
          ]),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- A-10 Item page

class ItemScreen extends ConsumerWidget {
  const ItemScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final item = ref.watch(listingProvider(id));
    return item.when(
      loading: () => Scaffold(appBar: AppBar(), body: const Padding(padding: EdgeInsets.all(S.screen), child: Column(children: [Skeleton(height: 260), SizedBox(height: S.s4), Skeleton(), SizedBox(height: S.s2), Skeleton(width: 160)]))),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: e is ApiException && e.kind == ApiErrorKind.notFound
            ? EmptyState(icon: PhosphorIconsRegular.package, text: l.noLongerAvailable)
            : ErrorRetry(error: e, onRetry: () => ref.invalidate(listingProvider(id))),
      ),
      data: (d) => _ItemBody(d),
    );
  }
}

class _ItemBody extends ConsumerStatefulWidget {
  const _ItemBody(this.d);
  final ListingDetail d;
  @override
  ConsumerState<_ItemBody> createState() => _ItemBodyState();
}

class _ItemBodyState extends ConsumerState<_ItemBody> {
  int _page = 0;
  bool _contacting = false;

  Future<void> _contact() async {
    final l = L.of(context);
    final session = ref.read(sessionProvider);
    if (!session.signedIn) return showSignInSheet(context, returnTo: '/item/${widget.d.id}');
    final store = ref.read(storeProvider);
    if (!await store.safetySeen) {
      if (!mounted) return;
      final go = await showSafetySheet(context, ref);
      if (go != true) return;
      await store.markSafetySeen();
    }
    setState(() => _contacting = true);
    try {
      final url = await ref.read(repoProvider).contact(widget.d.id);
      final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
      if (!ok && mounted) await _noWhatsapp();
    } on ApiException catch (e) {
      if (mounted) toast(context, e.code == 'CONTACT_LIMIT' ? l.contactLimit : errorText(l, e));
    } finally {
      if (mounted) setState(() => _contacting = false);
    }
  }

  Future<void> _noWhatsapp() async {
    final l = L.of(context);
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s4),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(l.whatsappMissing, style: T.h3),
            const SizedBox(height: S.s4),
            Btn(l.installWhatsapp, kind: BtnKind.whatsapp, onPressed: () => launchUrl(Uri.parse('https://play.google.com/store/apps/details?id=com.whatsapp'), mode: LaunchMode.externalApplication)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final d = widget.d;
    final hindi = ref.watch(hindiProvider);
    final locale = hindi ? 'hi' : 'en';
    final saved = ref.watch(savedIdsProvider).contains(d.id) || d.saved;
    final cats = ref.watch(categoriesProvider).value ?? const <Category>[];
    final cat = cats.where((c) => c.name == d.categoryName).firstOrNull;
    Widget rent(int? paise, String suffix) => paise == null
        ? const SizedBox.shrink()
        : Padding(padding: const EdgeInsets.only(right: S.s4), child: Text.rich(TextSpan(children: [TextSpan(text: rupees(paise), style: T.priceLarge), TextSpan(text: suffix, style: T.secondary)])));

    return Scaffold(
      backgroundColor: C.surface,
      appBar: AppBar(actions: [
        if (!d.isOwner) SaveButton(id: d.id, saved: saved),
        IconButton(tooltip: l.share, icon: const Icon(PhosphorIconsRegular.shareNetwork), onPressed: () => context.push('/share/${d.id}')),
        if (!d.isOwner)
          PopupMenuButton<String>(
            tooltip: l.more,
            onSelected: (v) => v == 'report' ? showReportSheet(context, ref, listingId: d.id) : _block(d.ownerId),
            itemBuilder: (_) => [PopupMenuItem(value: 'report', child: Text(l.report)), PopupMenuItem(value: 'block', child: Text(l.blockOwner))],
          ),
      ]),
      body: ListView(padding: const EdgeInsets.only(bottom: 96), children: [
        if (d.images.isEmpty)
          Photo(null, icon: categoryIcon(d.categoryIcon), radius: 0)
        else
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Stack(children: [
              PageView.builder(
                itemCount: d.images.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => _Zoom(d.images, i))),
                  child: Photo(d.images[i], radius: 0),
                ),
              ),
              if (d.images.length > 1)
                Positioned(
                  right: S.s3,
                  bottom: S.s3,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: S.s2, vertical: 2),
                    decoration: BoxDecoration(color: C.ink.withValues(alpha: 0.7), borderRadius: BorderRadius.circular(R.input)),
                    child: Text('${_page + 1}/${d.images.length}', style: T.label.copyWith(color: C.surface)),
                  ),
                ),
            ]),
          ),
        Padding(
          padding: const EdgeInsets.all(S.screen),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text((cat?.label(hindi) ?? d.categoryName).toUpperCase(), style: T.label.copyWith(letterSpacing: 0.6)),
            const SizedBox(height: S.s1),
            Text(d.title, style: T.h1),
            const SizedBox(height: S.s3),
            Wrap(runSpacing: S.s1, children: [rent(d.rentDay, l.perDay), rent(d.rentWeek, l.perWeek), rent(d.rentMonth, l.perMonth)]),
            if (d.rentedOut) ...[const SizedBox(height: S.s2), Text(l.rentedOutNow, style: T.strong.copyWith(color: C.warning))],
            const SizedBox(height: S.s4),
            const Divider(),
            _Fact(PhosphorIconsRegular.shieldCheck, l.deposit, d.deposit == null ? '—' : rupees(d.deposit!)),
            _Fact(PhosphorIconsRegular.sparkle, l.condition, switch (d.condition) { 'NEW' => l.condNEW, 'LIKE_NEW' => l.condLIKE_NEW, 'FAIR' => l.condFAIR, _ => l.condGOOD }),
            _Fact(PhosphorIconsRegular.mapPin, l.area, [d.areaName, d.cityName, if (d.distanceKm != null) l.kmAway(km(d.distanceKm!))].join(' · ')),
            for (final f in cat?.fields ?? const <ExtraField>[])
              if (d.extra[f.key] != null) _Fact(PhosphorIconsRegular.info, hindi && f.labelHi != null ? f.labelHi! : f.label, '${d.extra[f.key]}'),
            const Divider(),
            const SizedBox(height: S.s4),
            Text(d.description, style: T.body15),
            const SizedBox(height: S.s5),
            CardBox(
              onTap: d.shopId == null ? null : () => context.push('/shop/${d.shopId}'),
              child: Row(children: [
                CircleAvatar(backgroundColor: C.primarySoft, child: Text(d.ownerFirstName.characters.first.toUpperCase(), style: T.h3.copyWith(color: C.primary))),
                const SizedBox(width: S.s3),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(child: Text(d.shopName ?? d.ownerFirstName, style: T.strong, overflow: TextOverflow.ellipsis)),
                      if (d.verified) ...[const SizedBox(width: S.s1), const Icon(PhosphorIconsFill.sealCheck, color: C.primary, size: 16), const SizedBox(width: 2), Text(l.verified, style: T.label.copyWith(color: C.primary))],
                    ]),
                    Text(l.memberSince(monthYear(d.ownerSince, locale)), style: T.secondary),
                  ]),
                ),
                if (d.shopId != null) const Icon(PhosphorIconsRegular.caretRight, size: 18, color: C.ink2),
              ]),
            ),
          ]),
        ),
      ]),
      bottomNavigationBar: d.isOwner
          ? null
          : SafeArea(
              child: Container(
                padding: const EdgeInsets.fromLTRB(S.screen, S.s3, S.screen, S.s3),
                decoration: const BoxDecoration(color: C.surface, border: Border(top: BorderSide(color: C.line))),
                child: Btn(l.chatOnWhatsapp, kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, loading: _contacting, onPressed: d.rentedOut ? null : _contact),
              ),
            ),
    );
  }

  Future<void> _block(String userId) async {
    final l = L.of(context);
    if (!ref.read(sessionProvider).signedIn) return showSignInSheet(context);
    try {
      await ref.read(repoProvider).block(userId);
      if (mounted) {
        toast(context, l.blocked);
        context.pop();
      }
    } catch (e) {
      if (mounted) toast(context, errorText(l, e));
    }
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.icon, this.label, this.value);
  final IconData icon;
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: S.s3),
        child: Row(children: [
          Icon(icon, size: 20, color: C.ink2),
          const SizedBox(width: S.s3),
          SizedBox(width: 96, child: Text(label, style: T.secondary)),
          Expanded(child: Text(value, style: T.body15)),
        ]),
      );
}

class _Zoom extends StatelessWidget {
  const _Zoom(this.images, this.start);
  final List<String> images;
  final int start;
  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: C.ink,
        appBar: AppBar(backgroundColor: C.ink, foregroundColor: C.surface, shape: const Border()),
        body: PageView.builder(
          controller: PageController(initialPage: start),
          itemCount: images.length,
          itemBuilder: (_, i) => InteractiveViewer(maxScale: 4, child: Center(child: Photo(images[i], radius: 0))),
        ),
      );
}

// ---------------------------------------------------------------- A-11 Safety tips

Future<bool?> showSafetySheet(BuildContext context, WidgetRef ref) {
  final l = L.of(context);
  final s = ref.read(settingsProvider).value;
  final hindi = ref.read(hindiProvider);
  final tips = (hindi ? s?.safetyTipsHi : s?.safetyTips) ?? const <String>[];
  return showModalBottomSheet<bool>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.safetyTitle, style: T.h2),
          const SizedBox(height: S.s3),
          for (final (i, t) in tips.indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: S.s3),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon([PhosphorIconsRegular.usersThree, PhosphorIconsRegular.handshake, PhosphorIconsRegular.shieldWarning][i % 3], color: C.primary, size: 22),
                const SizedBox(width: S.s3),
                Expanded(child: Text(t, style: T.body15)),
              ]),
            ),
          const SizedBox(height: S.s2),
          Btn(l.openWhatsapp, kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, onPressed: () => Navigator.pop(ctx, true)),
        ]),
      ),
    ),
  );
}

// ---------------------------------------------------------------- A-13 Report

Future<void> showReportSheet(BuildContext context, WidgetRef ref, {String? listingId, String? userId}) async {
  if (!ref.read(sessionProvider).signedIn) return showSignInSheet(context);
  await showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (_) => _ReportSheet(listingId: listingId, userId: userId));
}

class _ReportSheet extends ConsumerStatefulWidget {
  const _ReportSheet({this.listingId, this.userId});
  final String? listingId, userId;
  @override
  ConsumerState<_ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<_ReportSheet> {
  String? _reason;
  final _note = TextEditingController();
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final reasons = {
      'FAKE_ITEM': l.reasonFAKE_ITEM,
      'ADVANCE_PAYMENT': l.reasonADVANCE_PAYMENT,
      'WRONG_PRICE': l.reasonWRONG_PRICE,
      'OFFENSIVE': l.reasonOFFENSIVE,
      'OTHER': l.reasonOTHER,
    };
    return Padding(
      padding: EdgeInsets.fromLTRB(S.screen, 0, S.screen, MediaQuery.viewInsetsOf(context).bottom + S.s4),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(l.reportTitle, style: T.h2),
        const SizedBox(height: S.s2),
        RadioGroup<String>(
          groupValue: _reason,
          onChanged: (v) => setState(() => _reason = v),
          child: Column(children: [
            for (final e in reasons.entries) RadioListTile<String>(value: e.key, contentPadding: EdgeInsets.zero, title: Text(e.value, style: T.body15)),
          ]),
        ),
        TextField(controller: _note, maxLength: 300, maxLines: 2, decoration: InputDecoration(hintText: l.addNote)),
        const SizedBox(height: S.s3),
        Btn(l.report, loading: _busy, onPressed: _reason == null
            ? null
            : () async {
                setState(() => _busy = true);
                try {
                  await ref.read(repoProvider).report(listingId: widget.listingId, userId: widget.userId, reason: _reason!, note: _note.text.trim());
                  if (context.mounted) {
                    Navigator.pop(context);
                    toast(context, l.reportSent);
                  }
                } on ApiException catch (e) {
                  if (context.mounted) toast(context, e.kind == ApiErrorKind.conflict ? l.alreadyReported : errorText(l, e));
                } finally {
                  if (mounted) setState(() => _busy = false);
                }
              }),
      ]),
    );
  }
}

// ---------------------------------------------------------------- A-12 Saved items

class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final fav = ref.watch(favoritesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(l.navSaved)),
      body: fav.when(
        loading: () => const ListSkeleton(),
        error: (e, _) => ErrorRetry(error: e, onRetry: () => ref.invalidate(favoritesProvider)),
        data: (p) {
          // Unsaving re-fetches this list (SaveButton invalidates it).
          final items = p.items;
          Future.microtask(() => ref.read(savedIdsProvider.notifier).seed(items));
          if (items.isEmpty) return EmptyState(icon: PhosphorIconsRegular.heart, text: l.savedEmpty);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(favoritesProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.all(S.screen),
              itemCount: items.length,
              separatorBuilder: (_, _) => const SizedBox(height: S.s3),
              itemBuilder: (_, i) => ItemCard(items[i]),
            ),
          );
        },
      ),
    );
  }
}

// Shared helper for share links (used by share card too).
Future<void> shareText(String text) => SharePlus.instance.share(ShareParams(text: text));
