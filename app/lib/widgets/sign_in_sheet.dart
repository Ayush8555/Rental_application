import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/app_localizations.dart';
import '../theme/tokens.dart';
import 'common.dart';

/// Guests can look around; anything personal opens this sheet first.
Future<void> showSignInSheet(BuildContext context, {String? returnTo}) {
  final l = L.of(context);
  return showModalBottomSheet<void>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(S.screen, 0, S.screen, S.s4),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l.signInToContinue, style: T.h2),
          const SizedBox(height: S.s2),
          Text(l.signInSheetBody, style: T.body15.copyWith(color: C.ink2)),
          const SizedBox(height: S.s5),
          Btn(l.signIn, onPressed: () {
            Navigator.pop(ctx);
            context.push(returnTo == null ? '/login' : '/login?next=${Uri.encodeComponent(returnTo)}');
          }),
          const SizedBox(height: S.s2),
          Btn(l.notNow, kind: BtnKind.text, onPressed: () => Navigator.pop(ctx)),
        ]),
      ),
    ),
  );
}
