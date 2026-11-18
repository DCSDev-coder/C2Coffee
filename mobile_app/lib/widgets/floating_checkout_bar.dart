import 'package:flutter/material.dart';

import '../screens/loading_order_page.dart';
import '../screens/order_confirmation_page.dart';
import '../services/app_session_service.dart';
import '../services/cart_service.dart';
import '../services/catalog_api_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../utils/global_state.dart';
import 'order_status_banner.dart';

class FloatingCheckoutBar extends StatelessWidget {
  final double? bottomOffset;
  final double leftOffset;
  final double? rightOffset;
  final bool avoidOrderBanner;
  final bool hasSideButton;

  const FloatingCheckoutBar({
    super.key,
    this.bottomOffset,
    this.leftOffset = 24,
    this.rightOffset,
    this.avoidOrderBanner = true,
    this.hasSideButton = false,
  });

  static double safeBottomInset(BuildContext context) {
    final view = View.of(context);
    final physicalBottom = view.viewPadding.bottom / view.devicePixelRatio;
    final mqViewBottom = MediaQuery.viewPaddingOf(context).bottom;
    return physicalBottom > mqViewBottom ? physicalBottom : mqViewBottom;
  }

  static bool acceptsMobileOrders(StoreSummary? store) {
    if (store == null || !store.acceptsMobileOrdersNow) return false;
    final cutoff = store.mobileOrderCutoffAt;
    return cutoff == null || DateTime.now().isBefore(cutoff);
  }

  @override
  Widget build(BuildContext context) {
    final cart = CartService.instance;
    final session = AppSessionService.instance;
    final baseBottom = bottomOffset ?? (90 + safeBottomInset(context));

    return AnimatedBuilder(
      animation: Listenable.merge([
        cart,
        session,
        globalOrderStatusVisible,
        globalActiveOrders,
        globalOrderStatusRawStatus,
      ]),
      builder: (context, _) {
        final effectiveBottomOffset = baseBottom +
            (avoidOrderBanner && OrderStatusBanner.isShowing ? 94.0 : 0.0);
        final effectiveRightOffset =
            rightOffset ?? (hasSideButton ? 84.0 : 24.0);

        final isOpen = acceptsMobileOrders(session.selectedStore);
        final itemCount = cart.items.length;

        return AnimatedPositioned(
          duration: const Duration(milliseconds: 260),
          curve: Curves.easeOutCubic,
          left: leftOffset,
          right: effectiveRightOffset,
          bottom: effectiveBottomOffset,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 200),
            switchInCurve: Curves.easeOutCubic,
            switchOutCurve: Curves.easeInCubic,
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.94, end: 1.0).animate(animation),
                child: child,
              ),
            ),
            child: cart.items.isEmpty
                ? const SizedBox.shrink()
                : Material(
                    key: const ValueKey('floating_checkout_bar'),
                    color: isOpen ? AppColors.deepTeal : Colors.grey.shade600,
            elevation: 8,
            shadowColor: Colors.black.withValues(alpha: 0.24),
            borderRadius: BorderRadius.circular(30),
            child: InkWell(
              borderRadius: BorderRadius.circular(30),
              onTap: isOpen
                  ? () {
                      InteractiveFillingLoader.show(
                        context,
                        targetPage: const OrderConfirmationPage(),
                      );
                    }
                  : () => AppNotification.showWarning(
                        context,
                        session.selectedStore?.isOpenNow == true
                            ? 'Mobile ordering closes 10 minutes before the outlet closes. Please order earlier or visit the counter.'
                            : 'This outlet is currently closed. Choose an open outlet to order.',
                      ),
              child: Container(
                height: 54,
                padding: const EdgeInsets.symmetric(horizontal: 15),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          const Center(
                            child: Icon(
                              Icons.shopping_bag_outlined,
                              color: Colors.white,
                              size: 21,
                            ),
                          ),
                          Positioned(
                            top: -4,
                            right: -4,
                            child: Container(
                              constraints: const BoxConstraints(
                                minWidth: 20,
                                minHeight: 20,
                              ),
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 5),
                              decoration: BoxDecoration(
                                color: const Color(0xFFE5A93C),
                                borderRadius: BorderRadius.circular(10),
                                border:
                                    Border.all(color: Colors.white, width: 1.5),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '$itemCount',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  height: 1,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Checkout',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                              height: 1,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$itemCount ${itemCount == 1 ? 'item' : 'items'} in your bag',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.white.withValues(alpha: 0.72),
                              height: 1,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.arrow_forward_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
  }
}
