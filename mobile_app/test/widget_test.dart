// This is a basic Flutter widget test for your updated C2 Coffee app.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:c2_coffee/main.dart';

void main() {
  testWidgets('App creates its application shell',
      (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const C2CoffeeApp());
    await tester.pump(const Duration(seconds: 3));

    // The initial destination is resolved asynchronously by the splash flow.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
