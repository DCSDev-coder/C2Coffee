import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/cart_service.dart';
import '../services/checkout_api_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/global_state.dart';
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

        return Scaffold(
          backgroundColor: bgColor,
          body: Stack(
            children: [
              Column(
                children: [
                  _buildHeader(),
                  Expanded(
                    child: snapshot == null
                        ? _buildEmptyState()
                        : SingleChildScrollView(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 24,
                            ),
                            child: Column(
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
                                    onTap: () =>
                                        InteractiveFillingLoader.showPop(context),
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
                          ),
                  ),
                ],
              ),
              if (_isSubmitting)
                Container(
                  color: Colors.black.withValues(alpha: 0.18),
                  child: const Center(
                    child: CircularProgressIndicator(),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.only(
        top: MediaQuery.paddingOf(context).top + 14,
        bottom: 16,
        left: 20,
        right: 20,
      ),
      decoration: BoxDecoration(
        color: AppColors.deepTeal,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(20),
          bottomRight: Radius.circular(20),
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () => InteractiveFillingLoader.showPop(context),
              child: const Icon(
                Icons.arrow_back_ios,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
          const Text(
            'ORDER CONFIRMATION',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.white,
              letterSpacing: 1.0,
            ),
          ),
        ],
      ),
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
    return Container(
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
                child: item.imageAssetPath != null &&
                        item.imageAssetPath!.isNotEmpty
                    ? Image.asset(
                        item.imageAssetPath!,
                        fit: BoxFit.contain,
                      )
                    : const Icon(Icons.local_cafe_outlined, size: 40),
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
                              const TextSpan(
                                text: 'RM ',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 10,
                                  color: Colors.black87,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              TextSpan(
                                text: item.unitTotalRm.toStringAsFixed(2),
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
                      width: 92,
                      height: 30,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: orangeColor, width: 1),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          GestureDetector(
                            onTap: () {
                              _cart.updateQuantity(item.id, item.quantity - 1);
                              if (_cart.isEmpty && mounted) {
                                Navigator.pop(context);
                              }
                            },
                            child: Text(
                              '-',
                              style: TextStyle(
                                color: orangeColor,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(
                            '${item.quantity}',
                            style: TextStyle(
                              color: orangeColor,
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          GestureDetector(
                            onTap: () {
                              _cart.updateQuantity(item.id, item.quantity + 1);
                            },
                            child: Text(
                              '+',
                              style: TextStyle(
                                color: orangeColor,
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
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
    );
  }

  Widget _buildVoucherCard() {
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
      child: Row(
        children: [
          Image.asset(
            'assets/images/voucher.png',
            width: 46,
            height: 46,
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Voucher',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Voucher redemption will be connected after token checkout is stable.',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodCard(CartSnapshot snapshot) {
    final remainingBalance = _session.tokenBalance - snapshot.subtotalTokens;

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
            'RM ${snapshot.subtotalRm.toStringAsFixed(2)}',
          ),
          const SizedBox(height: 10),
          _buildSummaryRow(
            'Token Charge',
            '${snapshot.subtotalTokens} tokens',
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value) {
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
            color: orangeColor,
          ),
        ),
      ],
    );
  }

  Widget _buildCheckoutButton(CartSnapshot snapshot) {
    final hasEnoughBalance = _session.tokenBalance >= snapshot.subtotalTokens;

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
      final accessToken = await SecureSessionService.instance.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing access token.');
      }

      final result = await CheckoutApiService.instance.createTokenOrder(
        accessToken: accessToken,
        cart: snapshot,
      );

      _session.applyCheckoutResult(result);
      _cart.clear();
      globalOrderStatusVisible.value = true;

      if (!mounted) return;
      Navigator.pop(context, true);
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
