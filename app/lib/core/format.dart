import 'package:intl/intl.dart';

final _inr = NumberFormat.decimalPattern('en_IN');

/// 12000000 paise -> ₹1,20,000 (Indian grouping).
String rupees(int paise) {
  final r = paise / 100;
  return r == r.roundToDouble() ? '₹${_inr.format(r.round())}' : '₹${NumberFormat('#,##,##0.00', 'en_IN').format(r)}';
}

String km(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);

String shortDate(String iso, String locale) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  return DateFormat('d MMM y', locale).format(d);
}

String monthYear(String yyyyMm, String locale) {
  final d = DateTime.tryParse('$yyyyMm-01');
  return d == null ? yyyyMm : DateFormat('MMM y', locale).format(d);
}

String timeAgo(String iso, String locale) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.inMinutes < 1) return locale == 'hi' ? 'अभी' : 'now';
  if (diff.inHours < 1) return locale == 'hi' ? '${diff.inMinutes} मिनट' : '${diff.inMinutes} min';
  if (diff.inDays < 1) return locale == 'hi' ? '${diff.inHours} घंटे' : '${diff.inHours} h';
  if (diff.inDays < 7) return locale == 'hi' ? '${diff.inDays} दिन' : '${diff.inDays} d';
  return DateFormat('d MMM', locale).format(d);
}

bool versionBelow(String current, String minimum) {
  List<int> p(String v) => v.split('+').first.split('.').map((x) => int.tryParse(x) ?? 0).toList();
  final a = p(current), b = p(minimum);
  for (var i = 0; i < 3; i++) {
    final x = i < a.length ? a[i] : 0, y = i < b.length ? b[i] : 0;
    if (x != y) return x < y;
  }
  return false;
}
