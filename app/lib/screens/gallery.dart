import 'package:flutter/material.dart';
import '../theme/icons.dart';
import '../data/models.dart';
import '../l10n/app_localizations.dart';
import '../theme/tokens.dart';
import '../widgets/common.dart';
import '../widgets/item_card.dart';

/// P0-14: every core component in one place, for the UI review (section 10).
/// Reached only from debug builds via /gallery.
class GalleryScreen extends StatelessWidget {
  const GalleryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final l = L.of(context);
    final sample = ListingCard.fromJson({
      'id': 'sample',
      'title': 'Canon 1500D with 18-55mm lens',
      'category': {'name': 'Cameras', 'nameHi': 'कैमरा', 'icon': 'camera'},
      'area': {'name': 'Gomti Nagar'},
      'rentDayPaise': 45000,
      'distanceKm': 2.5,
      'verified': true,
      'sponsored': true,
    });
    const gap = SizedBox(height: S.s3);
    return Scaffold(
      appBar: AppBar(title: Text(l.galleryTitle)),
      body: ListView(padding: const EdgeInsets.all(S.screen), children: [
        const Text('Heading 22', style: T.h1),
        const Text('Heading 18', style: T.h2),
        const Text('Heading 16', style: T.h3),
        Text('Body 15 — ${l.tagline}', style: T.body15),
        const Text('Secondary 13', style: T.secondary),
        const Text('₹1,20,000', style: T.priceLarge),
        gap,
        Btn(l.sendOtp, onPressed: () {}),
        gap,
        Btn(l.saveDraft, kind: BtnKind.secondary, onPressed: () {}),
        gap,
        Btn(l.chatOnWhatsapp, kind: BtnKind.whatsapp, icon: PhosphorIconsFill.whatsappLogo, onPressed: () {}),
        gap,
        Btn(l.submit, loading: true, onPressed: () {}),
        gap,
        Btn(l.submit),
        gap,
        TextField(decoration: InputDecoration(labelText: l.title, helperText: l.titleHint)),
        gap,
        TextField(decoration: InputDecoration(labelText: l.utrLabel, errorText: l.utrInvalid)),
        gap,
        Wrap(spacing: S.s2, children: [ChoiceChip(label: Text(l.day), selected: true, onSelected: (_) {}), ChoiceChip(label: Text(l.week), selected: false, onSelected: (_) {})]),
        gap,
        const Wrap(spacing: S.s2, runSpacing: S.s2, children: [StatusPill('LIVE'), StatusPill('REVIEW'), StatusPill('RENTED_OUT'), StatusPill('HIDDEN'), StatusPill('PENDING'), StatusPill('APPROVED'), StatusPill('REJECTED'), StatusPill('DRAFT')]),
        gap,
        ItemCard(sample),
        gap,
        Align(alignment: Alignment.centerLeft, child: SponsoredCard(sample)),
        gap,
        const ListSkeleton(rows: 1),
        EmptyState(icon: PhosphorIconsRegular.heart, text: l.savedEmpty),
        const OfflineBanner(),
      ]),
    );
  }
}
