import 'package:flutter/material.dart';

/// Design tokens from BUILD_PLAN section 8. Screens use these only; no raw
/// colours, sizes or font names anywhere else.
abstract final class C {
  static const primary = Color(0xFF0F766E);
  static const primaryDark = Color(0xFF115E59);
  static const primarySoft = Color(0xFFE6F4F2);
  static const ink = Color(0xFF111827);
  static const ink2 = Color(0xFF4B5563);
  static const line = Color(0xFFE5E7EB);
  static const surface = Color(0xFFFFFFFF);
  static const background = Color(0xFFF5F6F4);
  static const accent = Color(0xFFC2410C);
  static const whatsapp = Color(0xFF15803D);
  static const danger = Color(0xFFB91C1C);
  static const warning = Color(0xFFB45309);
  static const navy = Color(0xFF0B1F3A);
  static const placeholder = Color(0xFFE9ECEA);
}

abstract final class S {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s5 = 20.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
  static const screen = 16.0; // side padding on every screen
  static const touch = 48.0;
}

abstract final class R {
  static const input = 8.0;
  static const card = 12.0;
  static const sheet = 20.0;
}

abstract final class T {
  static const head = 'Sora';
  static const body = 'NotoSans';
  static const fallback = ['NotoSansDevanagari'];

  static const h1 = TextStyle(fontFamily: head, fontFamilyFallback: fallback, fontSize: 22, fontWeight: FontWeight.w700, color: C.ink, height: 1.3);
  static const h2 = TextStyle(fontFamily: head, fontFamilyFallback: fallback, fontSize: 18, fontWeight: FontWeight.w600, color: C.ink, height: 1.3);
  static const h3 = TextStyle(fontFamily: head, fontFamilyFallback: fallback, fontSize: 16, fontWeight: FontWeight.w600, color: C.ink, height: 1.3);
  static const body15 = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 15, fontWeight: FontWeight.w400, color: C.ink, height: 1.45);
  static const strong = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 15, fontWeight: FontWeight.w600, color: C.ink, height: 1.45);
  static const secondary = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 13, fontWeight: FontWeight.w400, color: C.ink2, height: 1.4);
  static const label = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 12, fontWeight: FontWeight.w500, color: C.ink2, height: 1.3);
  static const price = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 16, fontWeight: FontWeight.w700, color: C.ink, fontFeatures: [FontFeature.tabularFigures()]);
  static const priceLarge = TextStyle(fontFamily: body, fontFamilyFallback: fallback, fontSize: 20, fontWeight: FontWeight.w700, color: C.ink, fontFeatures: [FontFeature.tabularFigures()]);
}

abstract final class M {
  static const fast = Duration(milliseconds: 150);
  static const normal = Duration(milliseconds: 220);
  static const curve = Curves.easeOut;
}
