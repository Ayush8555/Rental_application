import 'dart:typed_data';

import '../core/api.dart';
import 'models.dart';

/// Every API call the app makes, in one place (Appendix A).
class Repo {
  Repo(this.api);
  final Api api;

  // ---------------------------------------------------------------- auth / me
  Future<Json> login(String idToken, {String? consentVersion, String? referralCode}) =>
      api.post('/auth/firebase', {'idToken': idToken, 'consentVersion': ?consentVersion, 'referralCode': ?referralCode}, true);
  Future<void> logout(String? fcmToken) => api.post('/auth/logout', {'fcmToken': ?fcmToken});
  Future<Me> me() async => Me.fromJson(await api.get('/me'));
  Future<Me> updateMe({String? name, String? cityId, String? language}) async =>
      Me.fromJson(await api.patch('/me', {'name': ?name, 'cityId': ?cityId, 'language': ?language}));
  Future<void> acceptConsent(String version) => api.post('/me/consents', {'version': version});
  Future<Json> requestDeletion(String idToken, String? reason) => api.post('/me/delete-request', {'idToken': idToken, if (reason != null && reason.isNotEmpty) 'reason': reason});

  // ---------------------------------------------------------------- catalogue
  Future<List<City>> cities() async => ((await api.get('/cities'))['items'] as List).map((e) => City.fromJson(e as Json)).toList();
  Future<List<Area>> areas(String cityId) async => ((await api.get('/cities/$cityId/areas'))['items'] as List).map((e) => Area.fromJson(e as Json)).toList();
  Future<void> joinWaitlist(String cityId) => api.post('/cities/$cityId/waitlist');
  Future<List<Category>> categories() async => ((await api.get('/categories'))['items'] as List).map((e) => Category.fromJson(e as Json)).toList();
  Future<PublicSettings> settings() async => PublicSettings.fromJson(await api.get('/settings/public'));

  // ---------------------------------------------------------------- listings
  Future<Page<ListingCard>> search(Map<String, dynamic> q) async {
    final r = await api.get('/listings', query: q, appCheck: true);
    return Page((r['items'] as List).map((e) => ListingCard.fromJson(e as Json)).toList(), r['nextCursor'] as String?, (r['total'] as num?)?.toInt());
  }

  Future<List<ListingCard>> featured(String cityId) async =>
      ((await api.get('/listings/featured', query: {'city': cityId}))['items'] as List).map((e) => ListingCard.fromJson(e as Json)).toList();
  Future<ListingDetail> listing(String id) async => ListingDetail.fromJson(await api.get('/listings/$id'));
  Future<String> contact(String id) async => (await api.post('/listings/$id/contact', null, true))['whatsappUrl'] as String;
  Future<Page<OwnListing>> mine([String? cursor]) async {
    final r = await api.get('/listings/mine', query: {'cursor': cursor, 'limit': 50});
    return Page((r['items'] as List).map((e) => OwnListing.fromJson(e as Json)).toList(), r['nextCursor'] as String?);
  }

  Future<Json> createListing(Json body) => api.post('/listings', body);
  Future<Json> updateListing(String id, Json body) => api.patch('/listings/$id', body);
  Future<void> deleteListing(String id) => api.delete('/listings/$id');
  Future<Json> listingStatus(String id, String action) => api.post('/listings/$id/status', {'action': action});
  Future<Json> shareCard(String id) => api.get('/listings/$id/share-card');

  /// sign → PUT to storage → complete. Returns the upload id to attach.
  Future<String> upload(String purpose, Uint8List bytes, String contentType, {void Function(double)? onProgress}) async {
    final sign = await api.post('/uploads/sign', {'purpose': purpose, 'contentType': contentType, 'sizeBytes': bytes.length});
    await api.putSigned(sign['url'] as String, (sign['headers'] as Map).map((k, v) => MapEntry('$k', '$v')), bytes, onProgress: onProgress);
    final id = sign['uploadId'] as String;
    await api.post('/uploads/$id/complete');
    return id;
  }

  // ---------------------------------------------------------------- engagement
  Future<Page<ListingCard>> favorites([String? cursor]) async {
    final r = await api.get('/favorites', query: {'cursor': cursor});
    return Page((r['items'] as List).map((e) => ListingCard.fromJson(e as Json)).toList(), r['nextCursor'] as String?);
  }

  Future<void> save(String id) => api.post('/favorites/$id');
  Future<void> unsave(String id) => api.delete('/favorites/$id');
  Future<void> report({String? listingId, String? userId, required String reason, String? note}) =>
      api.post('/reports', {'listingId': ?listingId, 'userId': ?userId, 'reason': reason, if (note != null && note.isNotEmpty) 'note': note});
  Future<void> block(String userId) => api.post('/blocks/$userId');

  // ---------------------------------------------------------------- requests
  Future<Json> postRequest(Json body) => api.post('/requests', body);
  Future<List<Json>> myRequests() async => ((await api.get('/requests/mine'))['items'] as List).cast<Json>();
  Future<Json> requestDetail(String id) => api.get('/requests/$id');
  Future<String> replyToRequest(String id) async => (await api.post('/requests/$id/contact', null, true))['whatsappUrl'] as String;

  // ---------------------------------------------------------------- plans & payments
  Future<List<Plan>> plans() async => ((await api.get('/plans'))['items'] as List).map((e) => Plan.fromJson(e as Json)).toList();
  Future<Json> validateCoupon(String planId, String code) => api.post('/coupons/validate', {'planId': planId, 'couponCode': code});
  Future<Json> subscribe(String planId, {String? coupon}) => api.post('/subscriptions', {'planId': planId, 'couponCode': ?coupon}, true);
  Future<Json> listerSummary() => api.get('/me/lister-summary');
  Future<Payment> payment(String id) async => Payment.fromJson(await api.get('/payments/$id'));
  Future<List<Payment>> myPayments() async => ((await api.get('/payments/mine'))['items'] as List).map((e) => Payment.fromJson(e as Json)).toList();
  Future<Payment> submitProof(String id, String utr, String? screenshotId) async =>
      Payment.fromJson(await api.post('/payments/$id/proof', {'utr': utr, 'screenshotUploadId': ?screenshotId}, true));
  Future<Json> boost(String listingId, int days, {bool useCredit = false}) => api.post('/listings/$listingId/boost', {'days': days, if (useCredit) 'useCredit': true}, true);

  // ---------------------------------------------------------------- referral, notifications, shop, id
  Future<Json> referral() => api.get('/referral');
  Future<void> applyReferral(String code) => api.post('/referral/apply', {'code': code});
  Future<({List<AppNotification> items, int unread, String? next})> notifications([String? cursor]) async {
    final r = await api.get('/notifications', query: {'cursor': cursor});
    return (items: (r['items'] as List).map((e) => AppNotification.fromJson(e as Json)).toList(), unread: (r['unread'] as num).toInt(), next: r['nextCursor'] as String?);
  }

  Future<void> markRead({List<String>? ids, bool all = false}) => api.post('/notifications/read', all ? {'all': true} : {'ids': ids});
  Future<void> registerDevice(String token) => api.post('/devices', {'fcmToken': token, 'platform': 'android'});
  Future<Json> myShop() => api.get('/shops/me');
  Future<Json> saveShop(Json body) => api.put('/shops/me', body);
  Future<Json> shop(String id) => api.get('/shops/$id');
  Future<Json> idStatus() => api.get('/id-verifications/mine');
  Future<void> submitId(String uploadId) => api.post('/id-verifications', {'uploadId': uploadId});
}
