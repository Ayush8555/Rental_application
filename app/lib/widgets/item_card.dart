import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../theme/icons.dart';
import '../core/format.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../state/app_state.dart';
import '../theme/tokens.dart';
import 'common.dart';
import 'sign_in_sheet.dart';

String rentText(L l, ListingCard c) {
  if (c.rentDay != null) return '${rupees(c.rentDay!)}${l.perDay}';
  if (c.rentWeek != null) return '${rupees(c.rentWeek!)}${l.perWeek}';
  if (c.rentMonth != null) return '${rupees(c.rentMonth!)}${l.perMonth}';
  return '';
}

/// List card: photo left, title (2 lines), area · distance, price, verified,
/// save. Same component on Home, Search, Saved and Shop.
class ItemCard extends ConsumerWidget {
  const ItemCard(this.item, {super.key, this.trailing});
  final ListingCard item;
  final Widget? trailing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    final saved = ref.watch(savedIdsProvider).contains(item.id);
    final place = [item.areaName, if (item.distanceKm != null) l.kmAway(km(item.distanceKm!))].join(' · ');
    return CardBox(
      padding: const EdgeInsets.all(S.s3),
      onTap: () => context.push('/item/${item.id}'),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 112, child: Photo(item.thumbnail, icon: categoryIcon(item.categoryIcon))),
        const SizedBox(width: S.s3),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: T.strong),
            const SizedBox(height: S.s1),
            Text(place, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.secondary),
            const SizedBox(height: S.s2),
            Row(children: [
              Flexible(child: Text(rentText(l, item), style: T.price, overflow: TextOverflow.ellipsis)),
              if (item.verified) ...[
                const SizedBox(width: S.s2),
                Semantics(label: l.verified, child: const Icon(PhosphorIconsFill.sealCheck, size: 16, color: C.primary)),
              ],
            ]),
            if (item.sponsored) Text(l.sponsored, style: T.label.copyWith(color: C.accent)),
            if (!item.available) Text(l.notAvailableShort, style: T.label.copyWith(color: C.danger)),
          ]),
        ),
        trailing ?? SaveButton(id: item.id, saved: saved),
      ]),
    );
  }
}

class SaveButton extends ConsumerWidget {
  const SaveButton({super.key, required this.id, required this.saved});
  final String id;
  final bool saved;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = L.of(context);
    return IconButton(
      tooltip: saved ? l.saved : l.save,
      constraints: const BoxConstraints(minWidth: S.touch, minHeight: S.touch),
      icon: Icon(saved ? PhosphorIconsFill.heart : PhosphorIconsRegular.heart, color: saved ? C.accent : C.ink2),
      onPressed: () async {
        if (!ref.read(sessionProvider).signedIn) return showSignInSheet(context);
        final ids = ref.read(savedIdsProvider.notifier);
        ids.set(id, !saved); // optimistic
        try {
          saved ? await ref.read(repoProvider).unsave(id) : await ref.read(repoProvider).save(id);
          ref.invalidate(favoritesProvider);
        } catch (e) {
          ids.set(id, saved); // roll back
          if (context.mounted) toast(context, errorText(l, e));
        }
      },
    );
  }
}

/// Grid card, only for the Sponsored row.
class SponsoredCard extends StatelessWidget {
  const SponsoredCard(this.item, {super.key});
  final ListingCard item;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return SizedBox(
      width: 168,
      child: CardBox(
        padding: const EdgeInsets.all(S.s2),
        onTap: () => context.push('/item/${item.id}'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Photo(item.thumbnail, icon: categoryIcon(item.categoryIcon)),
          const SizedBox(height: S.s2),
          Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: T.secondary.copyWith(color: C.ink, fontWeight: FontWeight.w600)),
          const SizedBox(height: S.s1),
          Text(rentText(l, item), style: T.price.copyWith(fontSize: 15)),
          Text(l.sponsored, style: T.label.copyWith(color: C.accent)),
        ]),
      ),
    );
  }
}
