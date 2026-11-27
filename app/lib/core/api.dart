import 'dart:async';

import 'package:dio/dio.dart';
import 'config.dart';
import 'device_id.dart';
import 'phone_auth.dart';
import 'secure_store.dart';

enum ApiErrorKind { offline, server, auth, blocked, validation, notFound, rateLimited, conflict, other }

class ApiException implements Exception {
  ApiException(this.kind, this.code, this.message, {this.fields = const {}, this.status});
  final ApiErrorKind kind;
  final String code;
  final String message;
  final Map<String, String> fields;
  final int? status;

  @override
  String toString() => message;
}

/// One Dio instance for the whole app. Adds the access token, device id, app
/// version and App Check token; refreshes the access token once on 401 and
/// retries; turns server errors into [ApiException].
class Api {
  Api(this.store, {void Function()? onSignedOut}) : _onSignedOut = onSignedOut {
    dio = Dio(BaseOptions(
      baseUrl: Config.apiUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'X-App-Version': Config.appVersion},
    ));
    dio.interceptors.add(InterceptorsWrapper(onRequest: _onRequest));
  }

  final SecureStore store;
  late final Dio dio;
  void Function()? _onSignedOut;
  set onSignedOut(void Function() fn) => _onSignedOut = fn;
  Future<bool>? _refreshing;

  Future<void> _onRequest(RequestOptions o, RequestInterceptorHandler h) async {
    o.headers['X-Device-Id'] = await DeviceId.get();
    final token = await store.accessToken;
    if (token != null && o.extra['noAuth'] != true) o.headers['Authorization'] = 'Bearer $token';
    if (o.extra['appCheck'] == true) {
      final ac = await AppCheckTokens.get();
      if (ac != null) o.headers['X-Firebase-AppCheck'] = ac;
    }
    h.next(o);
  }

  Future<bool> _refresh() {
    return _refreshing ??= () async {
      try {
        final rt = await store.refreshToken;
        if (rt == null) return false;
        final r = await Dio(BaseOptions(baseUrl: Config.apiUrl)).post<Map<String, dynamic>>(
          '/auth/refresh',
          data: {'refreshToken': rt},
          options: Options(headers: {'X-Device-Id': await DeviceId.get()}),
        );
        final d = r.data!;
        await store.saveTokens(d['accessToken'] as String, d['refreshToken'] as String);
        return true;
      } catch (_) {
        return false;
      } finally {
        _refreshing = null;
      }
    }();
  }

  Future<T> _send<T>(Future<Response<T>> Function() call, {bool retried = false}) async {
    try {
      final r = await call();
      return r.data as T;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 && !retried && await store.refreshToken != null) {
        final code = _code(e);
        if (code == 'SESSION_EXPIRED' || code == 'LOGIN_REQUIRED' || code == 'UNAUTHORIZED') {
          if (await _refresh()) return _send(call, retried: true);
          await store.clear();
          _onSignedOut?.call();
        }
      }
      throw _toApiException(e);
    }
  }

  String? _code(DioException e) {
    final d = e.response?.data;
    if (d is Map && d['error'] is Map) return (d['error'] as Map)['code'] as String?;
    return null;
  }

  ApiException _toApiException(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout || e.type == DioExceptionType.receiveTimeout) {
      return ApiException(ApiErrorKind.offline, 'OFFLINE', 'offline');
    }
    final status = e.response?.statusCode ?? 0;
    final d = e.response?.data;
    final err = d is Map && d['error'] is Map ? d['error'] as Map : const {};
    final code = (err['code'] as String?) ?? 'ERROR';
    final message = (err['message'] as String?) ?? 'Something went wrong';
    final details = err['details'];
    final fields = <String, String>{};
    if (details is Map && details['fields'] is Map) {
      (details['fields'] as Map).forEach((k, v) => fields['$k'] = '$v');
    }
    final kind = switch (status) {
      400 => ApiErrorKind.validation,
      401 => ApiErrorKind.auth,
      403 => code == 'ACCOUNT_BLOCKED' ? ApiErrorKind.blocked : ApiErrorKind.auth,
      404 => ApiErrorKind.notFound,
      409 => ApiErrorKind.conflict,
      429 => ApiErrorKind.rateLimited,
      >= 500 => ApiErrorKind.server,
      _ => ApiErrorKind.other,
    };
    return ApiException(kind, code, message, fields: fields, status: status);
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query, bool appCheck = false}) =>
      _send(() => dio.get<Map<String, dynamic>>(path, queryParameters: query?..removeWhere((_, v) => v == null || v == ''), options: Options(extra: {'appCheck': appCheck})));

  Future<Map<String, dynamic>> post(String path, [Object? body, bool appCheck = false]) =>
      _send(() => dio.post<Map<String, dynamic>>(path, data: body ?? const <String, dynamic>{}, options: Options(extra: {'appCheck': appCheck})));

  Future<Map<String, dynamic>> patch(String path, Object body) => _send(() => dio.patch<Map<String, dynamic>>(path, data: body));
  Future<Map<String, dynamic>> put(String path, Object body) => _send(() => dio.put<Map<String, dynamic>>(path, data: body));
  Future<Map<String, dynamic>> delete(String path) => _send(() => dio.delete<Map<String, dynamic>>(path));

  /// Uploads bytes to the signed URL the server handed out. No auth header:
  /// the URL itself carries a short-lived signature.
  Future<void> putSigned(String url, Map<String, String> headers, List<int> bytes, {void Function(double)? onProgress}) async {
    try {
      await Dio().put<void>(
        url,
        data: Stream.fromIterable([bytes]),
        options: Options(headers: {...headers, Headers.contentLengthHeader: bytes.length}),
        onSendProgress: (s, t) => onProgress?.call(t > 0 ? s / t : 0),
      );
    } on DioException catch (e) {
      throw _toApiException(e);
    }
  }
}
