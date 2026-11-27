import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../theme/icons.dart';
import '../core/api.dart';
import '../l10n/app_localizations.dart';
import '../theme/tokens.dart';

// ---------------------------------------------------------------- buttons

enum BtnKind { primary, secondary, text, whatsapp, danger }

class Btn extends StatelessWidget {
  const Btn(this.label, {super.key, this.onPressed, this.kind = BtnKind.primary, this.loading = false, this.icon, this.full = true});
  final String label;
  final VoidCallback? onPressed;
  final BtnKind kind;
  final bool loading, full;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final bg = switch (kind) { BtnKind.primary => C.primary, BtnKind.whatsapp => C.whatsapp, BtnKind.danger => C.danger, _ => C.surface };
    final fg = switch (kind) { BtnKind.primary || BtnKind.whatsapp || BtnKind.danger => C.surface, BtnKind.secondary || BtnKind.text => C.primary };
    final child = loading
        ? SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
        : Row(mainAxisSize: MainAxisSize.min, children: [
            if (icon != null) ...[Icon(icon, size: 20, color: fg), const SizedBox(width: S.s2)],
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: T.strong.copyWith(color: fg))),
          ]);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(R.card),
      side: kind == BtnKind.secondary ? const BorderSide(color: C.primary) : BorderSide.none,
    );
    final btn = kind == BtnKind.text
        ? TextButton(onPressed: loading ? null : onPressed, style: TextButton.styleFrom(minimumSize: const Size(S.touch, S.touch), shape: shape), child: child)
        : FilledButton(
            onPressed: loading ? null : onPressed,
            style: FilledButton.styleFrom(
              backgroundColor: bg,
              foregroundColor: fg,
              disabledBackgroundColor: kind == BtnKind.secondary ? C.surface : bg.withValues(alpha: 0.45),
              minimumSize: const Size(S.touch, 52),
              padding: const EdgeInsets.symmetric(horizontal: S.s5),
              shape: shape,
              elevation: 0,
            ),
            child: child,
          );
    return full && kind != BtnKind.text ? SizedBox(width: double.infinity, child: btn) : btn;
  }
}

// ---------------------------------------------------------------- photos

/// Real photos at 4:3 in lists. Grey box with the category icon while loading
/// or when there is no photo.
class Photo extends StatelessWidget {
  const Photo(this.url, {super.key, this.icon, this.ratio = 4 / 3, this.radius = R.input});
  final String? url;
  final IconData? icon;
  final double ratio, radius;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(color: C.placeholder, alignment: Alignment.center, child: Icon(icon ?? PhosphorIconsRegular.image, color: C.ink2, size: 28));
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: AspectRatio(
        aspectRatio: ratio,
        child: url == null ? placeholder : CachedNetworkImage(imageUrl: url!, fit: BoxFit.cover, placeholder: (_, _) => placeholder, errorWidget: (_, _, _) => placeholder, fadeInDuration: M.fast),
      ),
    );
  }
}

IconData categoryIcon(String name) => switch (name) {
      'camera' => PhosphorIconsRegular.camera,
      'wrench' => PhosphorIconsRegular.wrench,
      'armchair' => PhosphorIconsRegular.armchair,
      'moped' => PhosphorIconsRegular.moped,
      'bicycle' => PhosphorIconsRegular.bicycle,
      'device-mobile' => PhosphorIconsRegular.deviceMobile,
      'confetti' => PhosphorIconsRegular.confetti,
      'book' => PhosphorIconsRegular.book,
      'tent' => PhosphorIconsRegular.tent,
      'television' => PhosphorIconsRegular.television,
      'game-controller' => PhosphorIconsRegular.gameController,
      'baby' => PhosphorIconsRegular.baby,
      _ => PhosphorIconsRegular.package,
    };

// ---------------------------------------------------------------- states

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 16, this.width, this.radius = R.input});
  final double height;
  final double? width;
  final double radius;
  @override
  Widget build(BuildContext context) => Container(height: height, width: width, decoration: BoxDecoration(color: C.placeholder, borderRadius: BorderRadius.circular(radius)));
}

/// Grey blocks in the shape of the list rows (no spinners on lists).
class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.rows = 6});
  final int rows;
  @override
  Widget build(BuildContext context) => ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(S.screen),
        itemCount: rows,
        separatorBuilder: (_, _) => const SizedBox(height: S.s3),
        itemBuilder: (_, _) => const Row(children: [
          Skeleton(height: 84, width: 112),
          SizedBox(width: S.s3),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Skeleton(), SizedBox(height: S.s2), Skeleton(width: 120), SizedBox(height: S.s3), Skeleton(width: 80, height: 18)])),
        ]),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.text, this.action, this.onAction});
  final IconData icon;
  final String text;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(S.s6),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(icon, size: 40, color: C.primary),
          const SizedBox(height: S.s3),
          Text(text, style: T.body15),
          if (action != null) ...[const SizedBox(height: S.s4), Btn(action!, onPressed: onAction, full: false)],
        ]),
      );
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});
  final Object error;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    return EmptyState(icon: PhosphorIconsRegular.wifiSlash, text: errorText(l, error), action: l.retry, onAction: onRetry);
  }
}

String errorText(L l, Object e) {
  if (e is ApiException) {
    return switch (e.kind) {
      ApiErrorKind.offline => l.networkError,
      ApiErrorKind.server => l.serverDown,
      ApiErrorKind.blocked => l.accountBlocked,
      _ => e.message,
    };
  }
  return l.somethingWrong;
}

void toast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text), duration: const Duration(seconds: 3)));
}

// ---------------------------------------------------------------- pills, sections

class StatusPill extends StatelessWidget {
  const StatusPill(this.status, {super.key});
  final String status;
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final (label, fg, bg) = switch (status) {
      'LIVE' || 'APPROVED' => (status == 'LIVE' ? l.statusLIVE : l.statusAPPROVED, C.primaryDark, C.primarySoft),
      'REVIEW' => (l.statusREVIEW, C.warning, const Color(0xFFFDF3E4)),
      'PENDING' || 'CREATED' => (l.statusPENDING, C.warning, const Color(0xFFFDF3E4)),
      'RENTED_OUT' => (l.statusRENTED_OUT, C.navy, const Color(0xFFE8EEF8)),
      'REJECTED' => (l.statusREJECTED, C.danger, const Color(0xFFFDECEC)),
      'HIDDEN' => (l.statusHIDDEN, C.ink2, const Color(0xFFEEF0F2)),
      _ => (l.statusDRAFT, C.ink2, const Color(0xFFEEF0F2)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: S.s2, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: T.label.copyWith(color: fg, fontWeight: FontWeight.w600)),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(S.screen, S.s5, S.screen, S.s2),
        child: Row(children: [Expanded(child: Text(text, style: T.h3)), ?trailing]),
      );
}

class CardBox extends StatelessWidget {
  const CardBox({super.key, required this.child, this.padding = const EdgeInsets.all(S.s4), this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: C.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.card), side: const BorderSide(color: C.line)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      );
}

/// Shows "No internet" at the top when a request fails offline.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        color: C.navy,
        padding: const EdgeInsets.symmetric(horizontal: S.screen, vertical: S.s2),
        child: Text(L.of(context).offlineBanner, style: T.secondary.copyWith(color: C.surface)),
      );
}
