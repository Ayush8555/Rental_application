import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'data/models.dart';
import 'screens/account.dart';
import 'screens/browse.dart';
import 'screens/gallery.dart';
import 'screens/lister.dart';
import 'screens/money.dart';
import 'screens/onboarding.dart';
import 'state/app_state.dart';

// Deep links (App Links): https://www.<domain>/i/<shortId> opens the item.
// Parameters from links are validated before use (M4).
final _shortId = RegExp(r'^[A-Z0-9]{10}$');
final _uuid = RegExp(r'^[0-9a-f-]{36}$');

/// Paths that need a signed-in user; guests are sent to sign in and back.
const _private = ['/add-item', '/edit-item', '/plans', '/pay', '/utr', '/payment', '/payments', '/boost', '/notifications', '/delete-account', '/refer', '/request', '/my-requests', '/id-verify', '/my-shop', '/edit-profile', '/my-items', '/saved'];

GoRouter buildRouter(WidgetRef ref) {
  final rootKey = GlobalKey<NavigatorState>();
  return GoRouter(
    navigatorKey: rootKey,
    initialLocation: '/',
    redirect: (context, state) {
      final loc = state.matchedLocation;
      if (loc.startsWith('/i/')) {
        final id = state.pathParameters['shortId'] ?? '';
        return _shortId.hasMatch(id) ? null : '/home';
      }
      final s = ref.read(sessionProvider);
      if (s.status == AuthStatus.unknown) return loc == '/' ? null : null;
      if (!s.signedIn && _private.any((p) => loc == p || loc.startsWith('$p/'))) {
        return '/login?next=${Uri.encodeComponent(state.uri.toString())}';
      }
      if (loc == '/gallery' && !kDebugMode) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeScreen()),
      GoRoute(path: '/update', builder: (_, _) => const ForceUpdateScreen()),
      GoRoute(path: '/login', builder: (_, s) => PhoneScreen(next: _safeNext(s.uri.queryParameters['next']))),
      GoRoute(path: '/otp', builder: (_, s) => OtpScreen(args: s.extra! as OtpArgs)),
      GoRoute(path: '/profile-setup', builder: (_, s) => ProfileSetupScreen(next: _safeNext(s.uri.queryParameters['next']))),
      GoRoute(path: '/edit-profile', builder: (_, _) => const ProfileSetupScreen(editing: true)),
      GoRoute(path: '/choose-city', builder: (_, s) => CityPickerScreen(pickOnly: s.uri.queryParameters['pick'] == '1', guest: s.uri.queryParameters['guest'] == '1')),
      GoRoute(path: '/coming-soon', builder: (_, s) => ComingSoonScreen(city: s.extra! as City)),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/home', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/search', builder: (_, s) => SearchScreen(initialCategory: _uuidOrNull(s.uri.queryParameters['category'])))]),
          StatefulShellBranch(routes: [GoRoute(path: '/my-items', builder: (_, _) => const MyItemsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/saved', builder: (_, _) => const SavedScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/profile', builder: (_, _) => const ProfileScreen())]),
        ],
      ),
      GoRoute(path: '/item/:id', builder: (_, s) => ItemScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/i/:shortId', builder: (_, s) => _ShortLink(s.pathParameters['shortId']!)),
      GoRoute(path: '/add-item', builder: (_, _) => const EditItemScreen()),
      GoRoute(path: '/edit-item', builder: (_, s) => EditItemScreen(existing: s.extra as OwnListing?)),
      GoRoute(path: '/boost/:id', builder: (_, s) => BoostScreen(listingId: s.pathParameters['id']!)),
      GoRoute(path: '/share/:id', builder: (_, s) => ShareCardScreen(listingId: s.pathParameters['id']!)),
      GoRoute(path: '/plans', builder: (_, _) => const PlansScreen()),
      GoRoute(path: '/pay', builder: (_, s) => PayScreen(payment: s.extra! as Payment)),
      GoRoute(path: '/utr', builder: (_, s) => UtrScreen(payment: s.extra! as Payment)),
      GoRoute(path: '/payment/:id', builder: (_, s) => PaymentStatusScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/payments', builder: (_, _) => const MyPaymentsScreen()),
      GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
      GoRoute(path: '/delete-account', builder: (_, _) => const DeleteAccountScreen()),
      GoRoute(path: '/help', builder: (_, _) => const HelpScreen()),
      GoRoute(path: '/refer', builder: (_, _) => const ReferScreen()),
      GoRoute(path: '/request', builder: (_, s) => RequestItemScreen(text: s.uri.queryParameters['text'], categoryId: _uuidOrNull(s.uri.queryParameters['category']))),
      GoRoute(path: '/my-requests', builder: (_, _) => const MyRequestsScreen()),
      GoRoute(path: '/request-reply/:id', builder: (_, s) => RequestReplyScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/id-verify', builder: (_, _) => const IdVerifyScreen()),
      GoRoute(path: '/my-shop', builder: (_, _) => const MyShopScreen()),
      GoRoute(path: '/shop/:id', builder: (_, s) => ShopScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/gallery', builder: (_, _) => const GalleryScreen()),
    ],
  );
}

String? _uuidOrNull(String? v) => v != null && _uuid.hasMatch(v) ? v : null;

/// Only in-app paths, never another site (no open redirect).
String? _safeNext(String? v) => v != null && v.startsWith('/') && !v.startsWith('//') && v.length < 200 ? v : null;

/// Shared links carry the short id; the search API can resolve it from the
/// public page. Until the app has a lookup endpoint we open the web page's item
/// id by asking the API through the share card path.
class _ShortLink extends ConsumerWidget {
  const _ShortLink(this.shortId);
  final String shortId;
  @override
  Widget build(BuildContext context, WidgetRef ref) => FutureBuilder<Json>(
        future: ref.read(repoProvider).api.get('/listings/by-short/$shortId'),
        builder: (context, snap) {
          if (snap.hasData) {
            WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/item/${snap.data!['id']}'));
          } else if (snap.hasError) {
            WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/home'));
          }
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        },
      );
}
