import 'dart:math';

import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/cart_service.dart';
import '../services/checkout_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../services/voucher_intent_service.dart';
import '../utils/app_colors.dart';
import '../utils/global_state.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/payment_service_notice_popup.dart';
import '../widgets/voucher_modal.dart';
import 'loading_order_page.dart';
import 'order_status_detail_page.dart';
import 'orders_page.dart';
import 'top_up_wallet_page.dart';

class OrderConfirmationPage extends StatefulWidget {
  const OrderConfirmationPage({super.key, this.initialQuantity = 1});

  final int initialQuantity;

  @override
  State<OrderConfirmationPage> createState() => _OrderConfirmationPageState();
}

class _OrderConfirmationPageState extends State<OrderConfirmationPage> {
  final CartService _cart = CartService.instance;
  final AppSessionService _session = AppSessionService.instance;
  final ScrollController _scrollController = ScrollController();

  bool _isSubmitting = false;
  RewardVoucher? _selectedVoucher;
  String? _checkoutError;
  String? _voucherGuidance;
  String? _checkoutIdempotencyKey;
  bool _showScrollToTop = false;

  Color get orangeColor => AppColors.deepTeal;

  CartSnapshot? get _snapshot => _cart.snapshot;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _applyRememberedVoucher();
    });
  }

  Future<void> _applyRememberedVoucher() async {
    final code = VoucherIntentService.instance.take()?.trim();
    final snapshot = _snapshot;
    if (code == null || code.isEmpty || snapshot == null || !mounted) return;

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;

      final vouchers = await CustomerDataService.instance.getRewardVouchers(
        accessToken: accessToken,
        onlyActive: true,
        onlyTokenCheckoutEligible: true,
      );

      RewardVoucher? rememberedVoucher;
      for (final voucher in vouchers) {
        final codeMatches =
            voucher.template.code.trim().toLowerCase() == code.toLowerCase();
        if (codeMatches) {
          rememberedVoucher = voucher;
          break;
        }
      }

      if (!mounted) return;
      if (rememberedVoucher != null &&
          rememberedVoucher.template.matchesCartSnapshot(snapshot)) {
        setState(() {
          _selectedVoucher = rememberedVoucher;
          _voucherGuidance = null;
          _checkoutError = null;
        });
        return;
      }

      setState(() {
        _voucherGuidance = rememberedVoucher == null
            ? 'We couldn’t find that voucher in your available rewards. Tap Apply Voucher to choose an eligible voucher.'
            : rememberedVoucher.template.usageInstructions;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _voucherGuidance =
            'Add the qualifying item first, then tap Apply Voucher to choose this reward.';
      });
    }
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    final shouldShow =
        _scrollController.hasClients && _scrollController.offset > 300;
    if (shouldShow != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShow);
    }
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
    );
  }

  String _formatTokenCount(int count) {
    return '$count ${count == 1 ? 'token' : 'tokens'}';
  }

  Future<void> _openTopUpWallet() async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => const TopUpWalletPage(),
      ),
    );
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _showEditRemarksDialog(CartItem item) async {
    final controller = TextEditingController(text: item.remarks?.trim() ?? '');
    final updatedRemarks = await showDialog<String>(
      context: context,
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: orangeColor.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.edit_note_rounded,
                      color: orangeColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Special Instructions',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 21,
                            fontWeight: FontWeight.bold,
                            color: orangeColor,
                          ),
                        ),
                        Text(
                          item.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14.5,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                  InkWell(
                    onTap: () => Navigator.pop(dialogContext),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              TextField(
                controller: controller,
                maxLines: 3,
                maxLength: 120,
                autofocus: true,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  color: Colors.black87,
                ),
                decoration: InputDecoration(
                  hintText: 'E.g. Less ice, extra hot, pack separately...',
                  hintStyle: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    color: Colors.grey.shade400,
                  ),
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  contentPadding: const EdgeInsets.all(14),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: AppColors.border, width: 1.4),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: orangeColor, width: 1.8),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.black87,
                        side: BorderSide(color: Colors.grey.shade300),
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Cancel',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () =>
                          Navigator.pop(dialogContext, controller.text.trim()),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: orangeColor,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Save Note',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (updatedRemarks == null || !mounted) return;
    _cart.updateRemarks(
      item.id,
      updatedRemarks.isEmpty ? null : updatedRemarks,
    );
  }

  @override
  Widget build(BuildContext context) {
    const bgColor = Colors.white;

    return AnimatedBuilder(
      animation: Listenable.merge([_cart, _session]),
      builder: (context, _) {
        final snapshot = _snapshot;
        final totalItemCount = snapshot == null
            ? 0
            : snapshot.items.fold<int>(0, (sum, item) => sum + item.quantity);

        return AppPageShell(
          title: 'CHECKOUT',
          onBack: () => InteractiveFillingLoader.showPop(context),
          backgroundColor: bgColor,
          scrollController: _scrollController,
          overlay: Stack(
            children: [
              if (_showScrollToTop && !_isSubmitting)
                Positioned(
                  right: 18,
                  bottom: 24 + MediaQuery.paddingOf(context).bottom,
                  child: Semantics(
                    button: true,
                    label: 'Back to top',
                    child: Material(
                      color: AppColors.deepTeal,
                      elevation: 5,
                      shadowColor: Colors.black26,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: _scrollToTop,
                        child: const SizedBox(
                          width: 48,
                          height: 48,
                          child: Icon(
                            Icons.keyboard_arrow_up_rounded,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (_isSubmitting)
                Container(
                  color: Colors.black.withValues(alpha: 0.22),
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24,
                        vertical: 20,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.12),
                            blurRadius: 18,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(color: orangeColor),
                          const SizedBox(height: 14),
                          Text(
                            'Placing your order...',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: orangeColor,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
          bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: snapshot == null
              ? _buildEmptyState()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildPickupStoreCard(snapshot),
                    const SizedBox(height: 22),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Row(
                          children: [
                            Text(
                              'Your Order',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: orangeColor,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                '$totalItemCount ${totalItemCount == 1 ? 'item' : 'items'}',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                  color: orangeColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                        InkWell(
                          onTap: () =>
                              InteractiveFillingLoader.showPop(context),
                          borderRadius: BorderRadius.circular(20),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: orangeColor.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: orangeColor.withValues(alpha: 0.22),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.add_rounded,
                                  size: 18,
                                  color: orangeColor,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  'Add More',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w700,
                                    color: orangeColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    for (final item in snapshot.items) ...[
                      _buildOrderCard(item),
                      const SizedBox(height: 14),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      'Rewards & Discounts',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
                      ),
                    ),
                    const SizedBox(height: 10),
                    IgnorePointer(
                      ignoring: _isSubmitting,
                      child: _buildVoucherCard(snapshot),
                    ),
                    if (_voucherGuidance != null) ...[
                      const SizedBox(height: 10),
                      _buildVoucherGuidance(_voucherGuidance!),
                    ],
                    const SizedBox(height: 20),
                    Text(
                      'Payment Method',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _buildPaymentMethodCard(snapshot),
                    const SizedBox(height: 20),
                    _buildSummaryCard(snapshot),
                    if (_checkoutError != null) ...[
                      const SizedBox(height: 16),
                      _buildErrorBanner(_checkoutError!),
                    ],
                    const SizedBox(height: 24),
                    _buildCheckoutButton(snapshot),
                    const SizedBox(height: 44),
                  ],
                ),
        );
      },
    );
  }

  Widget _buildPickupStoreCard(CartSnapshot snapshot) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.surfaceLight,
            Colors.white,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.4),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: orangeColor,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.storefront_rounded,
              color: Colors.white,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'PICKUP OUTLET',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                        color: orangeColor.withValues(alpha: 0.75),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.gold.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'Self-Pickup',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: orangeColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  snapshot.storeName,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 19,
                    fontWeight: FontWeight.bold,
                    color: orangeColor,
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Prepared fresh once your order is placed',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13.5,
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

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 48),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.shopping_bag_outlined,
                size: 40,
                color: orangeColor,
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Your cart is empty',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: orangeColor,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Add your favourite handcrafted drinks or treats first, then return here to checkout.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 16,
                color: Colors.black54,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () => InteractiveFillingLoader.showPop(context),
              icon: const Icon(Icons.local_cafe_outlined, size: 20),
              label: const Text(
                'Browse Menu',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: orangeColor,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 13,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderCard(CartItem item) {
    final hasDetails =
        item.displayDetails != null && item.displayDetails!.trim().isNotEmpty;
    final hasRemarks = item.remarks != null && item.remarks!.trim().isNotEmpty;

    return Dismissible(
      key: ValueKey(item.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 22),
        decoration: BoxDecoration(
          color: Colors.red.shade600,
          borderRadius: BorderRadius.circular(20),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.delete_outline_rounded, color: Colors.white, size: 28),
            SizedBox(height: 2),
            Text(
              'Remove',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
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
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border, width: 1.4),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
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
                  width: 82,
                  height: 82,
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: CatalogProductImage(
                    assetPath: item.imageAssetPath,
                    imageUrl: item.imageUrl,
                    width: 70,
                    height: 70,
                    fit: BoxFit.contain,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              item.name,
                              style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 19,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                                height: 1.15,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${_formatTokenCount(item.unitTotalTokens)} / ea',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13.5,
                                color: orangeColor,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (hasDetails) ...[
                        const SizedBox(height: 6),
                        Text(
                          item.displayDetails!.trim(),
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14.5,
                            color: Colors.black54,
                            height: 1.3,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      InkWell(
                        onTap: () => _showEditRemarksDialog(item),
                        borderRadius: BorderRadius.circular(10),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: hasRemarks
                                ? AppColors.gold.withValues(alpha: 0.14)
                                : const Color(0xFFF7F7F8),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: hasRemarks
                                  ? AppColors.gold.withValues(alpha: 0.45)
                                  : Colors.grey.shade200,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.edit_note_rounded,
                                size: 16,
                                color:
                                    hasRemarks ? orangeColor : Colors.black45,
                              ),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  hasRemarks
                                      ? 'Note: ${item.remarks!.trim()}'
                                      : 'Add special note',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 13.5,
                                    fontWeight: hasRemarks
                                        ? FontWeight.w700
                                        : FontWeight.w600,
                                    color: hasRemarks
                                        ? Colors.black87
                                        : Colors.black54,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Divider(color: AppColors.border.withValues(alpha: 0.7), height: 1),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: orangeColor.withValues(alpha: 0.35),
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildQuantityTapTarget(
                        icon: item.quantity <= 1
                            ? Icons.delete_outline_rounded
                            : Icons.remove_rounded,
                        iconColor: item.quantity <= 1
                            ? Colors.red.shade600
                            : orangeColor,
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
                      Container(
                        constraints: const BoxConstraints(minWidth: 32),
                        alignment: Alignment.center,
                        child: Text(
                          '${item.quantity}',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            color: orangeColor,
                            fontSize: 16.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      _buildQuantityTapTarget(
                        icon: Icons.add_rounded,
                        iconColor: orangeColor,
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
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text(
                      'Line Total',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12.5,
                        color: Colors.black45,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _formatTokenCount(item.lineTotalTokens),
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: orangeColor,
                      ),
                    ),
                  ],
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
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 36,
          height: 36,
          child: Icon(
            icon,
            size: 20,
            color: iconColor,
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
      return min(subtotalTokens,
          max(0, (subtotalTokens * (discountRm / subtotalRm)).round()));
    } else if (t.discountMode == 'percent_rm') {
      final discountRm = min(subtotalRm,
          subtotalRm * ((double.tryParse(t.discountValue) ?? 0) / 100));
      if (subtotalRm <= 0 || discountRm <= 0) return 0;
      return min(subtotalTokens,
          max(0, (subtotalTokens * (discountRm / subtotalRm)).round()));
    } else if (t.discountMode == 'free_drink') {
      final highestTokenItem = snapshot.items.isEmpty
          ? 0
          : snapshot.items.map((e) => e.tokenPrice).reduce(max);
      return min(subtotalTokens, highestTokenItem);
    }
    return 0;
  }

  Widget _buildVoucherCard(CartSnapshot snapshot) {
    final voucher = _selectedVoucher;
    final discountTokens = _calculateDiscountTokens(snapshot);

    return InkWell(
      onTap: () {
        VoucherModal.show(
          context,
          selectedVoucherId: voucher?.id,
          cartSnapshot: _snapshot,
          onVoucherSelected: (selected) {
            setState(() {
              _selectedVoucher = selected;
              _voucherGuidance = null;
            });
          },
        );
      },
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: voucher != null
              ? orangeColor.withValues(alpha: 0.06)
              : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: voucher != null ? orangeColor : AppColors.border,
            width: voucher != null ? 1.6 : 1.4,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: voucher != null
                    ? AppColors.gold.withValues(alpha: 0.22)
                    : AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Image.asset(
                'assets/images/voucher.png',
                fit: BoxFit.contain,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          voucher != null
                              ? voucher.template.displayLabel
                              : 'Apply Voucher',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ),
                      if (voucher != null && discountTokens > 0) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFE8F5E9),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            '-${_formatTokenCount(discountTokens)}',
                            style: const TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2E7D32),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    voucher != null
                        ? 'Applied to this order • Tap to change'
                        : 'Select an available reward or tier perk',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14.5,
                      color: voucher != null ? orangeColor : Colors.black54,
                      fontWeight:
                          voucher != null ? FontWeight.w700 : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            if (voucher != null)
              IconButton(
                tooltip: 'Remove voucher',
                onPressed: () {
                  setState(() {
                    _selectedVoucher = null;
                    _voucherGuidance = null;
                  });
                },
                icon: Icon(
                  Icons.close_rounded,
                  color: Colors.grey.shade600,
                  size: 20,
                ),
              )
            else
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Select',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: orangeColor,
                      ),
                    ),
                    const SizedBox(width: 2),
                    Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: orangeColor,
                    ),
                  ],
                ),
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
    final currentBalance = _session.tokenBalance;
    final remainingBalance = currentBalance - effectiveTokenCharge;
    final hasEnoughBalance = remainingBalance >= 0;
    final shortfall = effectiveTokenCharge - currentBalance;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: hasEnoughBalance
              ? orangeColor.withValues(alpha: 0.45)
              : Colors.orange.shade400,
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Image.asset('assets/images/wallet.png'),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'C2 Token Wallet',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_formatTokenCount(currentBalance)} available',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: hasEnoughBalance
                            ? orangeColor
                            : Colors.red.shade700,
                      ),
                    ),
                    Text(
                      hasEnoughBalance
                          ? 'Balance after checkout: ${_formatTokenCount(remainingBalance)}'
                          : 'Short by ${_formatTokenCount(shortfall)} for this order',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13.5,
                        color: hasEnoughBalance
                            ? Colors.black54
                            : Colors.red.shade600,
                      ),
                    ),
                  ],
                ),
              ),
              if (hasEnoughBalance)
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: orangeColor,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                )
              else
                TextButton.icon(
                  onPressed: _openTopUpWallet,
                  icon: const Icon(Icons.add_circle_outline_rounded, size: 17),
                  label: const Text(
                    'Top Up',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  style: TextButton.styleFrom(
                    backgroundColor: orangeColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
            ],
          ),
          if (!hasEnoughBalance) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF8E1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    size: 18,
                    color: Colors.amber.shade900,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Add at least ${_formatTokenCount(shortfall)} to your wallet to complete this order.',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Colors.amber.shade900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSummaryCard(CartSnapshot snapshot) {
    final discountTokens = _calculateDiscountTokens(snapshot);
    final finalTokens = max(0, snapshot.subtotalTokens - discountTokens);
    final totalQuantity =
        snapshot.items.fold<int>(0, (sum, item) => sum + item.quantity);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Order Summary',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 19,
              fontWeight: FontWeight.bold,
              color: orangeColor,
            ),
          ),
          const SizedBox(height: 12),
          _buildSummaryRow(
            'Subtotal ($totalQuantity ${totalQuantity == 1 ? 'item' : 'items'})',
            _formatTokenCount(snapshot.subtotalTokens),
          ),
          if (discountTokens > 0) ...[
            const SizedBox(height: 10),
            _buildSummaryRow(
              'Voucher Discount',
              '-${_formatTokenCount(discountTokens)}',
              isDiscount: true,
            ),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Divider(
              color: AppColors.border,
              height: 1,
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Total Token Charge',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 19,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _formatTokenCount(finalTokens),
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 21,
                      fontWeight: FontWeight.bold,
                      color: orangeColor,
                    ),
                  ),
                  Text(
                    'Equivalent to RM $finalTokens',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(
    String label,
    String value, {
    bool isDiscount = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: isDiscount ? const Color(0xFF2E7D32) : orangeColor,
          ),
        ),
      ],
    );
  }

  Widget _buildVoucherGuidance(String text) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.deepTeal.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.deepTeal.withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.info_outline_rounded, color: AppColors.deepTeal, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                height: 1.3,
                color: Colors.grey.shade800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.error_outline_rounded,
            color: Colors.red.shade700,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Colors.red.shade800,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckoutButton(CartSnapshot snapshot) {
    final discountTokens = _calculateDiscountTokens(snapshot);
    final effectiveTokenCharge =
        max(0, snapshot.subtotalTokens - discountTokens);
    final hasEnoughBalance = _session.tokenBalance >= effectiveTokenCharge;
    final canPlaceOrder = hasEnoughBalance;
    final shortfall = effectiveTokenCharge - _session.tokenBalance;

    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        onPressed: _isSubmitting
            ? null
            : canPlaceOrder
                ? () => _submitCheckout(snapshot)
                : _openTopUpWallet,
        style: ElevatedButton.styleFrom(
          backgroundColor: orangeColor,
          foregroundColor: Colors.white,
          disabledBackgroundColor: orangeColor.withValues(alpha: 0.45),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(27),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              canPlaceOrder
                  ? Icons.lock_outline_rounded
                  : Icons.account_balance_wallet_outlined,
              size: 20,
              color: Colors.white,
            ),
            const SizedBox(width: 8),
            Text(
              _isSubmitting
                  ? 'PROCESSING ORDER...'
                  : canPlaceOrder
                      ? 'PLACE ORDER'
                      : 'TOP UP WALLET (+${_formatTokenCount(shortfall)})',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 18,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
                color: Colors.white,
              ),
            ),
            if (!_isSubmitting && canPlaceOrder) ...[
              const SizedBox(width: 10),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  _formatTokenCount(effectiveTokenCharge),
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _submitCheckout(CartSnapshot snapshot) async {
    if (_isSubmitting) return;

    setState(() {
      _isSubmitting = true;
      _checkoutError = null;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Your session has expired. Please sign in again.',
          code: 'session_not_found',
        );
      }

      if (!mounted) return;
      await showPendingPaymentServiceNotice(context);
      if (!mounted) return;

      final checkoutResult = await CheckoutApiService.instance.createTokenOrder(
        accessToken: accessToken,
        cart: snapshot,
        idempotencyKey: _checkoutIdempotencyKey ??=
            _newCheckoutIdempotencyKey(),
        appliedVoucherId: _selectedVoucher?.id,
      );

      _session.applyCheckoutResult(checkoutResult);
      _cart.clear();
      globalOrderStatusVisible.value = true;

      final createdOrder = await _loadCreatedOrder(
        accessToken: accessToken,
        orderId: checkoutResult.order.id,
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 220),
          pageBuilder: (context, animation, secondaryAnimation) =>
              FadeTransition(
            opacity: animation,
            child: createdOrder == null
                ? const OrdersPage(initialTabIndex: 0)
                : OrderStatusDetailPage(order: createdOrder),
          ),
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _checkoutError = friendlyCustomerErrorMessage(
          error,
          fallback:
              'We could not place your order right now. Please try again.',
        );
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<CustomerOrder?> _loadCreatedOrder({
    required String accessToken,
    required int orderId,
  }) async {
    try {
      final orders = await CustomerDataService.instance.getOrders(
        accessToken: accessToken,
        limit: 20,
      );
      for (final order in orders.orders) {
        if (order.id == orderId) return order;
      }
    } catch (_) {
      // Checkout already succeeded. Fall back to My Orders if the status
      // snapshot cannot be loaded immediately.
    }
    return null;
  }

  String _newCheckoutIdempotencyKey() {
    final randomPart =
        Random.secure().nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
    return '${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}_$randomPart';
  }
}
