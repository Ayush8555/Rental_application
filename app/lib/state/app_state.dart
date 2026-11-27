import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/phone_auth.dart';
import '../core/secure_store.dart';
import '../data/models.dart';
import '../data/repo.dart';

final storeProvider = Provider<SecureStore>((_) => SecureStore());
final phoneAuthProvider = Provider<PhoneAuth>((_) => PhoneAuth.create());
final apiProvider = Provider<Api>((ref) => Api(ref.watch(storeProvider)));
final repoProvider = Provider<Repo>((ref) => Repo(ref.watch(apiProvider)));

enum AuthStatus { unknown, guest, signedIn }

class Session {
  const Session(this.status, [this.me, this.guestCityId, this.guestLanguage = 'en']);
  final AuthStatus status;
  final Me? me;
  final String? guestCityId;
  final String guestLanguage;
  bool get signedIn => status == AuthStatus.signedIn;
  bool get hindi => signedIn ? me?.language == 'hi' : guestLanguage == 'hi';
  String? get cityId => me?.city?.id ?? guestCityId;
  Session copyWith({String? guestCityId, String? guestLanguage}) => Session(status, me, guestCityId ?? this.guestCityId, guestLanguage ?? this.guestLanguage);
}

/// Who is using the app. Guest browsing is allowed (A-01); anything personal
/// needs a signed-in session.
class SessionNotifier extends Notifier<Session> {

  @override
  Session build() {
    ref.read(apiProvider).onSignedOut = () => state = const Session(AuthStatus.guest);
    return const Session(AuthStatus.unknown);
  }

  Repo get _repo => ref.read(repoProvider);

  Future<void> restore() async {
    final token = await ref.read(storeProvider).accessToken;
    if (token == null) {
      state = const Session(AuthStatus.guest);
      return;
    }
    try {
      state = Session(AuthStatus.signedIn, await _repo.me());
    } on ApiException catch (e) {
      // Offline: keep the saved session and let screens show the banner.
      if (e.kind == ApiErrorKind.offline) {
        state = const Session(AuthStatus.signedIn);
      } else {
        await ref.read(storeProvider).clear();
        state = const Session(AuthStatus.guest);
      }
    }
  }

  Future<bool> signIn(String idToken, {String? consentVersion, String? referralCode}) async {
    final r = await _repo.login(idToken, consentVersion: consentVersion, referralCode: referralCode);
    await ref.read(storeProvider).saveTokens(r['accessToken'] as String, r['refreshToken'] as String);
    final me = await _repo.me();
    state = Session(AuthStatus.signedIn, me);
    return r['needsProfile'] == true;
  }

  Future<void> refreshMe() async {
    if (!state.signedIn) return;
    state = Session(AuthStatus.signedIn, await _repo.me());
  }

  void setMe(Me me) => state = Session(AuthStatus.signedIn, me);

  /// Logout removes tokens, the push token on the server and anything cached.
  Future<void> signOut({String? fcmToken}) async {
    try {
      await _repo.logout(fcmToken);
    } catch (_) {}
    await ref.read(phoneAuthProvider).signOut();
    await ref.read(storeProvider).clear();
    ref.invalidate(favoritesProvider);
    ref.invalidate(myListingsProvider);
    state = Session(AuthStatus.guest, null, state.guestCityId, state.guestLanguage);
  }

  void setGuestCity(String id) => state = state.copyWith(guestCityId: id);
  void setGuestLanguage(String lang) => state = state.copyWith(guestLanguage: lang);
}

final sessionProvider = NotifierProvider<SessionNotifier, Session>(SessionNotifier.new);

/// City the app shows: the profile city, or the one a guest picked.
final currentCityIdProvider = Provider<String?>((ref) => ref.watch(sessionProvider).cityId);
final hindiProvider = Provider<bool>((ref) => ref.watch(sessionProvider).hindi);

final citiesProvider = FutureProvider<List<City>>((ref) => ref.watch(repoProvider).cities());
final categoriesProvider = FutureProvider<List<Category>>((ref) => ref.watch(repoProvider).categories());
final settingsProvider = FutureProvider<PublicSettings>((ref) => ref.watch(repoProvider).settings());
final areasProvider = FutureProvider.family<List<Area>, String>((ref, cityId) => ref.watch(repoProvider).areas(cityId));
final featuredProvider = FutureProvider.family<List<ListingCard>, String>((ref, cityId) => ref.watch(repoProvider).featured(cityId));
final listingProvider = FutureProvider.family<ListingDetail, String>((ref, id) => ref.watch(repoProvider).listing(id));
final favoritesProvider = FutureProvider<Page<ListingCard>>((ref) => ref.watch(repoProvider).favorites());
final myListingsProvider = FutureProvider<Page<OwnListing>>((ref) => ref.watch(repoProvider).mine());
final listerSummaryProvider = FutureProvider<Json>((ref) => ref.watch(repoProvider).listerSummary());
final plansProvider = FutureProvider<List<Plan>>((ref) => ref.watch(repoProvider).plans());
final paymentsProvider = FutureProvider<List<Payment>>((ref) => ref.watch(repoProvider).myPayments());
final paymentProvider = FutureProvider.family<Payment, String>((ref, id) => ref.watch(repoProvider).payment(id));
final notificationsProvider = FutureProvider((ref) => ref.watch(repoProvider).notifications());

/// Saved state toggled on cards, kept here so every list shows the same heart.
class SavedIds extends Notifier<Set<String>> {
  @override
  Set<String> build() => {};
  void set(String id, bool saved) => state = saved ? {...state, id} : ({...state}..remove(id));
  void seed(Iterable<ListingCard> items) => state = {...state, ...items.where((i) => i.saved).map((i) => i.id)};
}

final savedIdsProvider = NotifierProvider<SavedIds, Set<String>>(SavedIds.new);
