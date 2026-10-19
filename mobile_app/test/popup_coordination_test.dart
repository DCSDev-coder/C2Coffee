import 'dart:async';

import 'package:c2_coffee/services/catalog_api_service.dart';
import 'package:c2_coffee/services/notification_service.dart';
import 'package:c2_coffee/widgets/payment_service_notice_popup.dart';
import 'package:c2_coffee/widgets/poster_popup.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets(
      'maintenance dialog stays until a decision and poster waits behind it',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    late BuildContext pageContext;
    await tester.pumpWidget(MaterialApp(
      home: Builder(builder: (context) {
        pageContext = context;
        return const Scaffold(body: Text('Home'));
      }),
    ));

    final notice = PaymentServiceNotice.fromApi({
      'id': 42,
      'title': 'Payment service maintenance',
      'message': 'DuitNow maintenance',
      'payment_methods': ['duitnow_qr'],
      'starts_at': '2026-10-19T02:00:00.000Z',
      'ends_at': '2026-10-19T02:30:00.000Z',
      'is_popup_dismissed': false,
    });
    const banner = HomeBanner(
      id: 9,
      code: 'test-poster',
      title: 'Campaign',
      subtitle: 'Campaign poster',
      imageSource: '',
      mediaType: 'image',
      animationDurationMs: 0,
      bannerType: 'general',
      partnerName: null,
      sponsoredLabel: false,
      ctaLabel: null,
      actionType: 'none',
      actionValue: null,
      destinationType: 'menu',
      secondaryDestinationType: null,
      targetValue: null,
      startsAt: null,
      endsAt: null,
      placement: 'home',
      sortOrder: 0,
      floatingPriority: true,
      createdAt: null,
    );

    unawaited(showPaymentServiceNoticePopup(pageContext, notice));
    await tester.pumpAndSettle();
    expect(find.text('Payment service maintenance'), findsOneWidget);

    unawaited(showPosterPopup(pageContext, banner: banner));
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Payment service maintenance'), findsOneWidget);
    expect(find.text('Poster unavailable'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Payment service maintenance'), findsOneWidget);

    await tester.tap(find.text('Close for now'));
    await tester.pumpAndSettle();
    expect(find.text('Payment service maintenance'), findsNothing);
    expect(find.text('Poster unavailable'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
  });
}
