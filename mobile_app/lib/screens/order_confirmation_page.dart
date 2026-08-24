import 'dart:math';

import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/cart_service.dart';
import '../services/checkout_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/global_state.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/voucher_modal.dart';
import '../widgets/app_page_shell.dart';
import 'orders_page.dart';
import 'loading_order_page.dart';

class OrderConfirmationPage extends StatefulWidget {
  const OrderConfirmationPage({super.key, this.initialQuantity = 1});

  final int initialQuantity;

  @override
  State<OrderConfirmationPage> createState() => _OrderConfirmationPageState();
}

class _OrderConfirmationPageState extends State<OrderConfirmationPage> {
  final CartService _cart = CartService.instance;
  final AppSessionService _session = AppSessionService.instance;

  bool _isSubmitting = false;
  RewardVoucher? _selectedVoucher;
  String? _checkoutError;

  Color get orangeColor => AppColors.deepTeal;

  CartSnapshot? get _snapshot => _cart.snapshot;

  @override
  Widget build(BuildContext context) {
    const bgColor = Colors.white;

    return AnimatedBuilder(
      animation: Listenable.merge([_cart, _session]),
      builder: (context, _) {
        final snapshot = _snapshot;

        return AppPageShell(
          title: 'ORDER CONFIRMATION',
          onBack: () => InteractiveFillingLoader.showPop(context),
          backgroundColor: bgColor,
          overlay: _isSubmitting
              ? Container(
                  color: Colors.black.withValues(alpha: 0.18),
                  child: const Center(
                    child: CircularProgressIndicator(),
                  ),
                )
              : null,
          bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: snapshot == null
              ? _buildEmptyState()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your order',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      snapshot.storeName,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: Colors.black54,
                      ),
                    ),
                    const SizedBox(height: 12),
                    for (final item in snapshot.items) ...[
                      _buildOrderCard(item),
                      const SizedBox(height: 16),
                    ],
                    Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        onTap: () => InteractiveFillingLoader.showPop(context),
                        child: Text(
                          '+ Add order',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: orangeColor,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _buildVoucherCard(),
                    const SizedBox(height: 16),
                    _buildPaymentMethodCard(snapshot),
                    const SizedBox(height: 16),
                    _buildSummaryCard(snapshot),
                    const SizedBox(height: 12),
                    if (_checkoutError != null) ...[
                      const SizedBox(height: 16),
                      Text(
                        _checkoutError!,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.red,
                        ),
                      ),
                    ],
                    const SizedBox(height: 32),
                    _buildCheckoutButton(snapshot),
                    const SizedBox(height: 40),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.shopping_bag_outlined,
              size: 48,
              color: orangeColor,
            ),
            const SizedBox(height: 16),
            Text(
              'Your cart is empty.',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: orangeColor,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Add a drink or menu item first, then come back here to checkout.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                color: Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderCard(CartItem item) {
    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: Colors.red.shade600,
          borderRadius: BorderRadius.circular(16),
        ),
        child: const Icon(Icons.delete_outline, color: Colors.white, size: 28),
      ),
      onDismissed: (_) {
        _cart.removeItem(item.id);
        if (_cart.isEmpty && mounted) {
          Navigator.pop(context);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    color: Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: CatalogProductImage(
                    assetPath: item.imageAssetPath,
                    imageUrl: item.imageUrl,
                    width: 80,
                    height: 80,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              item.name,
                              style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                          ),
                          RichText(
                            text: TextSpan(
                              children: [
                                TextSpan(
                                  text: '${item.unitTotalTokens} tokens',
                                  style: const TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14,
                                    color: Colors.black87,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        [
                          if (item.displayDetails != null &&
                              item.displayDetails!.trim().isNotEmpty)
                            item.displayDetails!,
                          'Remarks: ${item.remarks?.trim().isNotEmpty == true ? item.remarks!.trim() : 'None'}',
                        ].join('\n'),
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 13,
                          color: Colors.black87,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Container(
                        width: 128,
                        height: 42,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: orangeColor, width: 1),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _buildQuantityTapTarget(
                              icon: Icons.remove,
                              onTap: () {
                                _cart.updateQuantity(
                                  item.id,
                                  item.quantity - 1,
                                );
                                if (_cart.isEmpty && mounted) {
                                  Navigator.pop(context);
                                }
                              },
                            ),
                            Text(
                              '${item.quantity}',
                              style: TextStyle(
                                color: orangeColor,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            _buildQuantityTapTarget(
                              icon: Icons.add,
                              onTap: () {
                                _cart.updateQuantity(
                                  item.id,
                                  item.quantity + 1,
                                );
                              },
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Divider(color: AppColors.border, height: 1),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Line Total',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  '${item.lineTotalTokens} tokens',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: orangeColor,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuantityTapTarget({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: SizedBox(
          width: 38,
          height: 38,
          child: Icon(
            icon,
            size: 24,
            color: orangeColor,
          ),
        ),
      ),
    );
  }

  int _calculateDiscountTokens(CartSnapshot snapshot) {
    if (_selectedVoucher == null) return 0;
    final t = _selectedVoucher!.template;
    final subtotalTokens = snapshot.subtotalTokens;
    final subtotalRm = snapshot.subtotalRm;
    if (t.discountMode == 'fixed_token') {
      final val = t.tokenValue ?? int.tryParse(t.discountValue) ?? 0;
      return min(subtotalTokens, val);
    } else if (t.discountMode == 'fixed_rm') {
      final discountRm = min(subtotalRm, double.tryParse(t.discountValue) ?? 0);
      if (subtotalRm <= 0 || discountRm <= 0) return 0;
      return min(subtotalTokens, max(0, (subtotalTokens * (discountRm / subtotalRm)).round()));
    } else if (t.discountMode == 'percent_rm') {
      final discountRm = min(subtotalRm, subtotalRm * ((double.tryParse(t.discountValue) ?? 0) / 100));
      if (subtotalRm <= 0 || discountRm <= 0) return 0;
      return min(subtotalTokens, max(0, (subtotalTokens * (discountRm / subtotalRm)).round()));
    } else if (t.discountMode == 'free_drink') {
      final highestTokenItem = snapshot.items.isEmpty
          ? 0
          : snapshot.items.map((e) => e.tokenPrice).reduce(max);
      return min(subtotalTokens, highestTokenItem);
    }
    return 0;
  }

  Widget _buildVoucherCard() {
    final voucher = _selectedVoucher;

    return InkWell(
      onTap: () {
        VoucherModal.show(
          context,
          selectedVoucherId: voucher?.id,
          cartSnapshot: _snapshot,
          onVoucherSelected: (selected) {
            setState(() {
              _selectedVoucher = selected;
            });
          },
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: voucher != null
              ? orangeColor.withValues(alpha: 0.05)
              : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: voucher != null
                ? orangeColor
                : orangeColor.withValues(alpha: 0.5),
            width: voucher != null ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Image.asset(
              'assets/images/voucher.png',
              width: 46,
              height: 46,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    voucher != null ? voucher.template.name : 'Apply Voucher',
                    style: const TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    voucher != null
                        ? 'Tap to change or remove'
                        : 'Select an available voucher for discount',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
                      color: voucher != null ? orangeColor : Colors.black54,
                      fontWeight:
                          voucher != null ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              voucher != null ? Icons.check_circle : Icons.chevron_right,
              color: voucher != null ? AppColors.gold : Colors.black45,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentMethodCard(CartSnapshot snapshot) {
    final discountTokens = _calculateDiscountTokens(snapshot);
    final effectiveTokenCharge =
        max(0, snapshot.subtotalTokens - discountTokens);
    final remainingBalance = _session.tokenBalance - effectiveTokenCharge;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: orangeColor.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Payment Method',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Image.asset(
                'assets/images/wallet.png',
                width: 55,
                height: 55,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Wallet',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    Text(
                      '${_session.tokenBalance} tokens available',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
                      ),
                    ),
                    Text(
                      'After checkout: ${remainingBalance >= 0 ? remainingBalance : 0} tokens',
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: orangeColor, width: 2),
                ),
                child: Center(
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: orangeColor,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(CartSnapshot snapshot) {
    final discountTokens = _calculateDiscountTokens(snapshot);
    final finalTokens = max(0, snapshot.subtotalTokens - discountTokens);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _buildSummaryRow(
            'Subtotal',
            '${snapshot.subtotalTokens} tokens',
          ),
          if (discountTokens > 0) ...[
            const SizedBox(height: 10),
            _buildSummaryRow(
              'Voucher Discount',
              '-$discountTokens tokens',
              isDiscount: true,
            ),
          ],
          const SizedBox(height: 10),
          _buildSummaryRow(
            'Token Charge',
            '$finalTokens tokens',
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value,
      {bool isDiscount = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: isDiscount ? Colors.green.shade700 : orangeColor,
          ),
        ),
      ],
    );
  }

  Widget _buildCheckoutButton(CartSnapshot snapshot) {
    final discountTokens = _calculateDiscountTokens(snapshot);
    final effectiveTokenCharge =
        max(0, snapshot.subtotalTokens - discountTokens);
    final hasEnoughBalance = _session.tokenBalance >= effectiveTokenCharge;

    return GestureDetector(
      onTap: _isSubmitting || !hasEnoughBalance
          ? null
          : () => _submitCheckout(snapshot),
      child: Container(
        width: double.infinity,
        height: 50,
        decoration: BoxDecoration(
          color: hasEnoughBalance
              ? orangeColor
              : orangeColor.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(25),
        ),
        child: Center(
          child: Text(
            hasEnoughBalance ? 'CHECKOUT' : 'INSUFFICIENT TOKENS',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _submitCheckout(CartSnapshot snapshot) async {
    setState(() {
      _isSubmitting = true;
      _checkoutError = null;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      final checkoutResult = await CheckoutApiService.instance.createTokenOrder(
        accessToken: accessToken,
        cart: snapshot,
        appliedVoucherId: _selectedVoucher?.id,
      );

      _session.applyCheckoutResult(checkoutResult);
      _cart.clear();
      globalOrderStatusVisible.value = true;

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 220),
          pageBuilder: (context, animation, secondaryAnimation) =>
              FadeTransition(
            opacity: animation,
            child: const OrdersPage(initialTabIndex: 0),
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _checkoutError = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }
}
