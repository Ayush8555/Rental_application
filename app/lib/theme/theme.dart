import 'package:flutter/material.dart';
import 'tokens.dart';

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: C.primary, primary: C.primary, surface: C.surface, error: C.danger, brightness: Brightness.light);
  OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: BorderRadius.circular(R.input), borderSide: BorderSide(color: c, width: w));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: C.background,
    fontFamily: T.body,
    fontFamilyFallback: T.fallback,
    textTheme: const TextTheme(
      headlineSmall: T.h1,
      titleLarge: T.h2,
      titleMedium: T.h3,
      bodyLarge: T.body15,
      bodyMedium: T.body15,
      bodySmall: T.secondary,
      labelSmall: T.label,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: C.surface,
      foregroundColor: C.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: T.h2,
      shape: Border(bottom: BorderSide(color: C.line)),
    ),
    dividerTheme: const DividerThemeData(color: C.line, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: S.s3, vertical: S.s3),
      border: border(C.line),
      enabledBorder: border(C.line),
      focusedBorder: border(C.primary, 1.5),
      errorBorder: border(C.danger),
      focusedErrorBorder: border(C.danger, 1.5),
      helperStyle: T.label,
      errorStyle: T.label.copyWith(color: C.danger),
      hintStyle: T.body15.copyWith(color: C.ink2),
      helperMaxLines: 3,
      errorMaxLines: 3,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: C.surface,
      showDragHandle: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(R.sheet))),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: C.ink,
      contentTextStyle: T.body15.copyWith(color: C.surface),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.card)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: C.surface,
      indicatorColor: C.primarySoft,
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => T.label.copyWith(color: s.contains(WidgetState.selected) ? C.primary : C.ink2)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: C.surface,
      selectedColor: C.primarySoft,
      side: const BorderSide(color: C.line),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(R.input)),
      labelStyle: T.secondary.copyWith(color: C.ink),
      showCheckmark: false,
    ),
    checkboxTheme: CheckboxThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? C.primary : null)),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: C.primary),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {TargetPlatform.android: FadeForwardsPageTransitionsBuilder()}),
  );
}
