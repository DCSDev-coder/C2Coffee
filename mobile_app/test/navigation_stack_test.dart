import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:c2_coffee/widgets/app_tutorial.dart';
import 'package:c2_coffee/widgets/custom_bottom_nav.dart';

class _RouteObserver extends NavigatorObserver {
  int removedRoutes = 0;

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    removedRoutes += 1;
    super.didRemove(route, previousRoute);
  }
}

void main() {
  test('tutorial targets are unique to each page instance', () {
    final firstHome = HomeTutorialTargets();
    final secondHome = HomeTutorialTargets();
    final firstWallet = WalletTutorialTargets();
    final secondWallet = WalletTutorialTargets();

    expect(identical(firstHome.walletKey, secondHome.walletKey), isFalse);
    for (var index = 0; index < firstHome.bottomNavKeys.length; index += 1) {
      expect(
        identical(
          firstHome.bottomNavKeys[index],
          secondHome.bottomNavKeys[index],
        ),
        isFalse,
      );
    }
    expect(identical(firstWallet.balanceKey, secondWallet.balanceKey), isFalse);
    expect(
      identical(firstWallet.packagesKey, secondWallet.packagesKey),
      isFalse,
    );
  });

  testWidgets('bottom-tab switching clears the previous navigation stack',
      (tester) async {
    final observer = _RouteObserver();

    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: [observer],
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (context) => Scaffold(
                    body: TextButton(
                      onPressed: () => CustomBottomNav.switchTab(
                        context,
                        const Scaffold(body: Text('Destination tab')),
                      ),
                      child: const Text('Switch tab'),
                    ),
                  ),
                ),
              ),
              child: const Text('Open detail'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open detail'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Switch tab'));
    await tester.pumpAndSettle();

    expect(find.text('Destination tab'), findsOneWidget);
    expect(observer.removedRoutes, 2);
  });
}
