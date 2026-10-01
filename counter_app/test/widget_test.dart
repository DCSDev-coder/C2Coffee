// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

import 'package:counter_app/auth_service.dart';
import 'package:counter_app/main.dart';

void main() {
  testWidgets('shows the device setup flow without a stored token', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ActivationScreen(authService: AuthService(), onActivated: () {}),
      ),
    );
    await tester.pump();

    expect(find.text('Device Setup'), findsOneWidget);
    expect(find.text('Register POS Device'), findsOneWidget);
    expect(find.text('Activate Device'), findsOneWidget);
  });
}
