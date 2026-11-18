import 'package:c2_coffee/services/cart_service.dart';
import 'package:c2_coffee/utils/global_state.dart';
import 'package:c2_coffee/widgets/app_page_shell.dart';
import 'package:c2_coffee/widgets/floating_checkout_bar.dart';
import 'package:c2_coffee/widgets/order_status_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(() {
    CartService.instance.clear();
    globalOrderStatusVisible.value = false;
    globalOrderStatusRawStatus.value = null;
    globalActiveOrders.value = const [];
  });

  testWidgets('FloatingCheckoutBar renders only when cart has items',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Stack(
            children: [
              FloatingCheckoutBar(),
            ],
          ),
        ),
      ),
    );

    expect(find.text('Checkout'), findsNothing);

    CartService.instance.addItem(
      storeId: 1,
      storeName: 'C2 Coffee Eco Forest',
      item: const CartItem(
        id: 'test-1',
        menuItemId: 101,
        menuItemCode: 'LATTE',
        name: 'Spanish Latte',
        basePriceRm: 12.0,
        tokenPrice: 10,
        quantity: 1,
      ),
    );
    await tester.pump();

    expect(find.text('Checkout'), findsOneWidget);
    expect(find.text('1 item in your bag'), findsOneWidget);
  });

  testWidgets(
      'FloatingCheckoutBar moves up above OrderStatusBanner when order banner is visible',
      (tester) async {
    CartService.instance.addItem(
      storeId: 1,
      storeName: 'C2 Coffee Eco Forest',
      item: const CartItem(
        id: 'test-1',
        menuItemId: 101,
        menuItemCode: 'LATTE',
        name: 'Spanish Latte',
        basePriceRm: 12.0,
        tokenPrice: 10,
        quantity: 1,
      ),
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Stack(
            fit: StackFit.expand,
            children: [
              FloatingCheckoutBar(hasSideButton: true),
              OrderStatusBanner(
                bottomOffset: 90,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    Positioned findCheckoutPositioned() {
      final positionedFinder = find.ancestor(
        of: find.text('Checkout'),
        matching: find.byType(Positioned),
      );
      return tester.widget<Positioned>(positionedFinder.first);
    }

    Positioned findBannerPositioned() {
      final positionedFinder = find.ancestor(
        of: find.text('Payment confirmed'),
        matching: find.byType(Positioned),
      );
      return tester.widget<Positioned>(positionedFinder.first);
    }

    expect(findCheckoutPositioned().left, 24);
    expect(findCheckoutPositioned().right, 84);
    expect(findCheckoutPositioned().bottom, 90);

    globalOrderStatusVisible.value = true;
    globalOrderStatusRawStatus.value = 'paid';
    await tester.pumpAndSettle();

    expect(findBannerPositioned().bottom, 90);
    expect(findCheckoutPositioned().bottom, 184);
  });

  testWidgets(
      'AppPageShell overlay keeps Press Me and FloatingCheckoutBar visible when OrderStatusBanner is hidden',
      (tester) async {
    CartService.instance.addItem(
      storeId: 1,
      storeName: 'C2 Coffee Eco Forest',
      item: const CartItem(
        id: 'test-1',
        menuItemId: 101,
        menuItemCode: 'LATTE',
        name: 'Spanish Latte',
        basePriceRm: 12.0,
        tokenPrice: 10,
        quantity: 1,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: AppPageShell(
          title: 'MENU',
          onBack: () {},
          showBackButton: false,
          scrollable: false,
          extendBody: true,
          bottomNavigationBar: const SizedBox(height: 90),
          overlay: const Stack(
            fit: StackFit.expand,
            children: [
              Positioned(
                right: 24,
                bottom: 93,
                child: SizedBox(
                  width: 48,
                  height: 48,
                  child: Center(child: Text('Press\nMe')),
                ),
              ),
              FloatingCheckoutBar(hasSideButton: true),
              OrderStatusBanner(),
            ],
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Press\nMe'), findsOneWidget);
    expect(find.text('Checkout'), findsOneWidget);

    final pressMeRect = tester.getRect(find.text('Press\nMe'));
    final checkoutRect = tester.getRect(find.text('Checkout'));
    expect(pressMeRect.width, greaterThan(0));
    expect(pressMeRect.height, greaterThan(0));
    expect(checkoutRect.width, greaterThan(0));
    expect(checkoutRect.height, greaterThan(0));
  });

  testWidgets(
      'FloatingCheckoutBar uses physical viewPadding inside Scaffold extendBody instead of zeroed MediaQuery viewPadding',
      (tester) async {
    tester.view.devicePixelRatio = 3.0;
    tester.view.viewPadding = const FakeViewPadding(bottom: 102.0);
    addTearDown(() {
      tester.view.resetDevicePixelRatio();
      tester.view.resetViewPadding();
    });

    CartService.instance.addItem(
      storeId: 1,
      storeName: 'C2 Coffee Eco Forest',
      item: const CartItem(
        id: 'test-1',
        menuItemId: 101,
        menuItemCode: 'LATTE',
        name: 'Spanish Latte',
        basePriceRm: 12.0,
        tokenPrice: 10,
        quantity: 1,
      ),
    );

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          extendBody: true,
          bottomNavigationBar: SizedBox(height: 90),
          body: Stack(
            fit: StackFit.expand,
            children: [
              FloatingCheckoutBar(),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    final checkoutPositioned = tester.widget<Positioned>(
      find
          .ancestor(
            of: find.text('Checkout'),
            matching: find.byType(Positioned),
          )
          .first,
    );
    // 90 + (102 / 3.0 = 34) = 124.
    expect(checkoutPositioned.bottom, 124);
  });

  testWidgets('Press Me smoothly animates up when scroll-to-top button appears',
      (tester) async {
    final showScrollToTop = ValueNotifier<bool>(false);
    addTearDown(showScrollToTop.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: showScrollToTop,
            builder: (context, showMoveUp, _) {
              final padBottom = FloatingCheckoutBar.safeBottomInset(context);
              final activeRowBottom = 90.0 + padBottom;
              final scrollToTopBottom = activeRowBottom + 3.0;
              final pressMeBottom =
                  scrollToTopBottom + (showMoveUp ? 60.0 : 0.0);
              return Stack(
                fit: StackFit.expand,
                children: [
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 260),
                    curve: Curves.easeOutCubic,
                    right: 24,
                    bottom: scrollToTopBottom,
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 200),
                      child: showMoveUp
                          ? const SizedBox(
                              key: ValueKey('scroll_to_top'),
                              width: 48,
                              height: 48,
                              child: Icon(Icons.keyboard_arrow_up_rounded),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ),
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 260),
                    curve: Curves.easeOutCubic,
                    right: 24,
                    bottom: pressMeBottom,
                    child: const SizedBox(
                      width: 48,
                      height: 48,
                      child: Center(child: Text('Press\nMe')),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
    await tester.pump();

    Positioned findPressMePositioned() => tester.widget<Positioned>(
          find
              .ancestor(
                of: find.text('Press\nMe'),
                matching: find.byType(Positioned),
              )
              .first,
        );

    expect(findPressMePositioned().bottom, 93.0);
    expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsNothing);

    showScrollToTop.value = true;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final midBottom = findPressMePositioned().bottom!;
    expect(midBottom, greaterThan(93.0));
    expect(midBottom, lessThan(153.0));

    await tester.pumpAndSettle();

    expect(find.byIcon(Icons.keyboard_arrow_up_rounded), findsOneWidget);
    expect(findPressMePositioned().bottom, 153.0);
  });

  testWidgets(
      'FloatingCheckoutBar smoothly animates between full bottom-menu width and side-button width',
      (tester) async {
    CartService.instance.addItem(
      storeId: 1,
      storeName: 'C2 Coffee Eco Forest',
      item: const CartItem(
        id: 'test-1',
        menuItemId: 101,
        menuItemCode: 'LATTE',
        name: 'Spanish Latte',
        basePriceRm: 12.0,
        tokenPrice: 10,
        quantity: 1,
      ),
    );
    final hasSideButton = ValueNotifier<bool>(false);
    addTearDown(hasSideButton.dispose);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: hasSideButton,
            builder: (context, showSide, _) {
              return Stack(
                fit: StackFit.expand,
                children: [
                  FloatingCheckoutBar(hasSideButton: showSide),
                ],
              );
            },
          ),
        ),
      ),
    );
    await tester.pump();

    Positioned findCheckoutPositioned() => tester.widget<Positioned>(
          find
              .ancestor(
                of: find.text('Checkout'),
                matching: find.byType(Positioned),
              )
              .first,
        );

    expect(findCheckoutPositioned().left, 24.0);
    expect(findCheckoutPositioned().right, 24.0);

    hasSideButton.value = true;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    final midRight = findCheckoutPositioned().right!;
    expect(midRight, greaterThan(24.0));
    expect(midRight, lessThan(84.0));

    await tester.pumpAndSettle();

    expect(findCheckoutPositioned().left, 24.0);
    expect(findCheckoutPositioned().right, 84.0);
  });
}
