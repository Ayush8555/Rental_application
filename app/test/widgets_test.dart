import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rentnook/core/format.dart';
import 'package:rentnook/data/models.dart';
import 'package:rentnook/l10n/app_localizations.dart';
import 'package:rentnook/screens/onboarding.dart';
import 'package:rentnook/theme/theme.dart';
import 'package:rentnook/widgets/common.dart';
import 'package:rentnook/widgets/item_card.dart';

Widget wrap(Widget child, {Locale locale = const Locale('en'), double scale = 1}) => ProviderScope(
      child: MaterialApp(
        theme: buildTheme(),
        locale: locale,
        supportedLocales: L.supportedLocales,
        localizationsDelegates: const [L.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
        home: MediaQuery(data: MediaQueryData(size: const Size(360, 800), textScaler: TextScaler.linear(scale)), child: child),
      ),
    );

ListingCard sample() => ListingCard.fromJson({
      'id': 'a',
      'title': 'Canon 1500D with 18-55mm lens and a spare battery for weddings',
      'category': {'name': 'Cameras', 'nameHi': 'कैमरा', 'icon': 'camera'},
      'area': {'name': 'Gomti Nagar'},
      'rentDayPaise': 45000,
      'distanceKm': 2.5,
      'verified': true,
    });

void main() {
  group('format', () {
    test('Indian rupee grouping', () {
      expect(rupees(12000000), '₹1,20,000');
      expect(rupees(79900), '₹799');
    });
    test('version compare for force update', () {
      expect(versionBelow('1.0.0', '1.0.1'), isTrue);
      expect(versionBelow('1.2.0', '1.1.9'), isFalse);
      expect(versionBelow('1.0.0+12', '1.0.0'), isFalse);
    });
  });

  testWidgets('A-02: Send OTP stays disabled until a valid number and consent', (t) async {
    await t.pumpWidget(wrap(const PhoneScreen()));
    await t.pumpAndSettle();
    final button = find.widgetWithText(FilledButton, 'Send OTP');
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.byType(TextField), '5123456789'); // must start 6-9
    await t.tap(find.byType(Checkbox));
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNull);
    await t.enterText(find.byType(TextField), '9876543210');
    await t.pump();
    expect(t.widget<FilledButton>(button).onPressed, isNotNull);
  });

  testWidgets('Welcome screen has both ways in', (t) async {
    await t.pumpWidget(wrap(const WelcomeScreen()));
    await t.pumpAndSettle();
    expect(find.text('Continue with mobile number'), findsOneWidget);
    expect(find.text('Just browse'), findsOneWidget);
  });

  testWidgets('U5/U6: item card fits a 360 px phone at 130% text', (t) async {
    await t.pumpWidget(wrap(Scaffold(body: Padding(padding: const EdgeInsets.all(16), child: ItemCard(sample()))), scale: 1.3));
    await t.pump();
    expect(t.takeException(), isNull);
    expect(find.text('₹450/day'), findsOneWidget);
  });

  testWidgets('U7: Hindi strings render on the welcome screen', (t) async {
    await t.pumpWidget(wrap(const WelcomeScreen(), locale: const Locale('hi')));
    await t.pumpAndSettle();
    expect(find.text('मोबाइल नंबर से आगे बढ़ें'), findsOneWidget);
    expect(t.takeException(), isNull);
  });

  testWidgets('U10: icon-only save button has a label for TalkBack', (t) async {
    await t.pumpWidget(wrap(const Scaffold(body: SaveButton(id: 'a', saved: false))));
    expect(find.byTooltip('Save'), findsOneWidget);
  });

  testWidgets('status pills use fixed labels', (t) async {
    await t.pumpWidget(wrap(const Scaffold(body: Column(children: [StatusPill('LIVE'), StatusPill('REVIEW'), StatusPill('RENTED_OUT')]))));
    expect(find.text('Live'), findsOneWidget);
    expect(find.text('Under review'), findsOneWidget);
    expect(find.text('Rented out'), findsOneWidget);
  });
}
