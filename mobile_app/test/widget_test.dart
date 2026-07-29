// This is a basic Flutter widget test for your updated C2 Coffee app.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter_test/flutter_test.dart';

import 'package:c2_coffee/main.dart';

void main() {
  testWidgets('App starts up to the Startup Selector',
      (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const C2CoffeeApp());

    // Verify that the Startup Selector screen loads correctly
    // by checking for the "Choose Your Layout" title.
    expect(find.text('Choose Your Layout'), findsOneWidget);

    // Verify the "Use Backup Design" button is on the screen
    expect(find.text('Use Backup Design'), findsOneWidget);
  });
}
