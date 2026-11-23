import 'package:flutter/material.dart';

enum OrderStatus { newOrder, preparing, readyForPickup, completed }

class OrderItem {
  final String title;
  final List<String> tags;
  final int? menuItemId;
  final String lineType;
  final String? campaignName;
  final String? assignmentMode;

  const OrderItem({
    required this.title,
    required this.tags,
    this.menuItemId,
    this.lineType = 'sale',
    this.campaignName,
    this.assignmentMode,
  });

  bool get isPromotionalAddon => lineType == 'promotional_addon';

  String get assignmentLabel => assignmentMode == 'server_random'
      ? 'Randomly assigned'
      : 'Customer selected';
}

class PromotionalGiftNotice extends StatelessWidget {
  const PromotionalGiftNotice({super.key, required this.items});

  final List<OrderItem> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    const accent = Color(0xFF8A4B08);
    return Container(
      key: const Key('promotional-gift-notice'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7E6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF2B84B), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.redeem_rounded, color: accent, size: 21),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'PROMOTIONAL GIFT — INCLUDE IN BAG',
                  style: TextStyle(
                    color: accent,
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (item.campaignName?.trim().isNotEmpty == true)
                    Text(
                      'Campaign: ${item.campaignName!.trim()}',
                      style: const TextStyle(
                        color: accent,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  Text(
                    item.assignmentLabel,
                    style: const TextStyle(
                      color: accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class CurrentOrder {
  OrderStatus status;
  final String orderId;
  String timeDate;
  final DateTime orderDate;
  final DateTime? statusStartedAt;
  final String customerDetails;
  final List<OrderItem> items;
  String? cancellationRequestStatus;
  final String? voucherName;
  final String? voucherType;
  final double discount;
  final int voucherDiscountTokens;
  final String? voucherRewardSummary;
  final String? paymentMethod;
  final String? paymentStatus;
  final String? paymentMode;
  final int tokenAmountCharged;
  final int subsidyTokenAmount;
  final bool isEmployee;
  final String subsidyRole;
  final String? orderChannel;
  final double total;

  CurrentOrder({
    required this.status,
    required this.orderId,
    required this.timeDate,
    required this.orderDate,
    this.statusStartedAt,
    required this.customerDetails,
    required this.items,
    this.cancellationRequestStatus,
    this.voucherName,
    this.voucherType,
    this.discount = 0,
    this.voucherDiscountTokens = 0,
    this.voucherRewardSummary,
    this.paymentMethod,
    this.paymentStatus,
    this.paymentMode,
    this.tokenAmountCharged = 0,
    this.subsidyTokenAmount = 0,
    this.isEmployee = false,
    this.subsidyRole = 'none',
    this.orderChannel,
    this.total = 0,
  });
}

class OrderCard extends StatelessWidget {
  final String timeDate;
  final OrderStatus status;
  final String orderId;
  final String customerDetails;
  final List<OrderItem> items;
  final VoidCallback? onActionPressed;
  final VoidCallback? onTap;
  final VoidCallback? onPrintPressed;
  final VoidCallback? onCancelPressed;
  final String cancelTooltip;
  final bool isActionLoading;
  final bool isPrintLoading;
  final String? cancellationRequestStatus;
  final String? voucherName;
  final String? voucherType;
  final double discount;
  final int voucherDiscountTokens;
  final String? voucherRewardSummary;
  final String? paymentMethod;
  final String? paymentStatus;
  final String? paymentMode;
  final int tokenAmountCharged;
  final int subsidyTokenAmount;
  final bool isEmployee;
  final String subsidyRole;
  final double total;

  const OrderCard({
    super.key,
    required this.timeDate,
    required this.status,
    required this.orderId,
    required this.customerDetails,
    required this.items,
    this.onActionPressed,
    this.onTap,
    this.onPrintPressed,
    this.onCancelPressed,
    this.cancelTooltip = 'Cancel order',
    this.isActionLoading = false,
    this.isPrintLoading = false,
    this.cancellationRequestStatus,
    this.voucherName,
    this.voucherType,
    this.discount = 0,
    this.voucherDiscountTokens = 0,
    this.voucherRewardSummary,
    this.paymentMethod,
    this.paymentStatus,
    this.paymentMode,
    this.tokenAmountCharged = 0,
    this.subsidyTokenAmount = 0,
    this.isEmployee = false,
    this.subsidyRole = 'none',
    this.total = 0,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    final standardItems = items
        .where((item) => !item.isPromotionalAddon)
        .toList(growable: false);
    final promotionalItems = items
        .where((item) => item.isPromotionalAddon)
        .toList(growable: false);

    final bool isPreparing = status == OrderStatus.preparing;
    final bool isReadyForPickup = status == OrderStatus.readyForPickup;
    final bool isHistory = status == OrderStatus.completed;
    final bool isManualPaymentPending =
        paymentStatus == 'pending' &&
        (paymentMethod == 'manual_counter' ||
            paymentMethod == 'manual_terminal' ||
            paymentMethod == 'manual_cash');
    final bool isDirectPaymentPending =
        paymentStatus == 'pending' && !isManualPaymentPending;

    final Color statusBg;
    final Color statusFg;
    final Color cardBorder;
    if (isReadyForPickup) {
      statusBg = const Color(0xFFDCFCE7);
      statusFg = const Color(0xFF166534);
      cardBorder = const Color(0xFF86EFAC);
    } else if (isPreparing) {
      statusBg = darkGreen;
      statusFg = Colors.white;
      cardBorder = darkGreen.withValues(alpha: 0.18);
    } else {
      statusBg = const Color(0xFFFEF3C7);
      statusFg = const Color(0xFF92400E);
      cardBorder = const Color(0xFFFCD34D);
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16.0),
          border: Border.all(
            color: isHistory
                ? const Color(0xFF203E32).withValues(alpha: 0.12)
                : cardBorder,
            width: isHistory ? 1.0 : 1.3,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Top Row: Date/Time and Status Pill
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      timeDate,
                      style: const TextStyle(
                        color: Colors.grey,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (!isHistory)
                    Hero(
                      tag: 'hero_status_$orderId',
                      child: Material(
                        color: Colors.transparent,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12.0,
                            vertical: 4.0,
                          ),
                          decoration: BoxDecoration(
                            color: statusBg,
                            borderRadius: BorderRadius.circular(20.0),
                          ),
                          child: Text(
                            isReadyForPickup
                                ? 'Ready for pickup'
                                : isPreparing
                                ? 'Preparing'
                                : isDirectPaymentPending
                                ? 'Awaiting payment'
                                : isManualPaymentPending
                                ? 'Pay at counter'
                                : 'New',
                            style: TextStyle(
                              color: statusFg,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6.0),
              if (cancellationRequestStatus == 'pending' ||
                  cancellationRequestStatus == 'refund_pending')
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF4D6),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    cancellationRequestStatus == 'refund_pending'
                        ? 'Cancellation approved — refund pending; do not prepare'
                        : 'Cancellation requested — review before preparing',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF8A5A00),
                    ),
                  ),
                ),

              // Order ID & Total on same row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Hero(
                        tag: 'hero_order_id_$orderId',
                        child: Material(
                          color: Colors.transparent,
                          child: Text(
                            orderId,
                            maxLines: 1,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: Colors.black,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        paymentMode == 'token'
                            ? '$tokenAmountCharged C2 Credit tokens paid'
                            : 'RM ${total.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFF203E32),
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (paymentMode == 'token')
                        Text(
                          'Order value RM ${total.toStringAsFixed(2)}',
                          style: TextStyle(
                            color: const Color(
                              0xFF203E32,
                            ).withValues(alpha: 0.65),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                    ],
                  ),
                  if (isHistory) ...[
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.chevron_right,
                      size: 24,
                      color: Colors.black,
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 2),

              // Customer Details
              Hero(
                tag: 'hero_customer_$orderId',
                child: Material(
                  color: Colors.transparent,
                  child: Text(
                    customerDetails,
                    style: TextStyle(
                      color: const Color(0xFF203E32).withValues(alpha: 0.65),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 7),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: isEmployee
                            ? const Color(0xFFE8F3F0)
                            : const Color(0xFFF3F4F6),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        subsidyRole == 'boss'
                            ? 'Boss'
                            : subsidyRole == 'intern'
                            ? 'Intern'
                            : isEmployee
                            ? 'Employee'
                            : 'Customer',
                        style: const TextStyle(
                          color: Color(0xFF203E32),
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8F5EC),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        paymentMode == 'token'
                            ? subsidyTokenAmount > 0
                                  ? tokenAmountCharged - subsidyTokenAmount > 0
                                        ? 'Payment: $subsidyTokenAmount company + ${tokenAmountCharged - subsidyTokenAmount} personal tokens'
                                        : 'Payment: $subsidyTokenAmount company allowance tokens'
                                  : 'Payment: $tokenAmountCharged personal C2 Credit tokens'
                            : 'Payment: Direct RM ${total.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFF5B4927),
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (voucherName != null && voucherName!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFCEFF9),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Voucher: ${voucherName!.trim()}',
                          style: const TextStyle(
                            color: Color(0xFF6B1A5B),
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        if (voucherRewardSummary?.trim().isNotEmpty == true)
                          Text(
                            'Applied to: ${voucherRewardSummary!.trim()}',
                            style: const TextStyle(
                              color: Color(0xFF6B1A5B),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        if (voucherDiscountTokens > 0)
                          Text(
                            'Discount: $voucherDiscountTokens C2 Credit tokens',
                            style: const TextStyle(
                              color: Color(0xFF6B1A5B),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          )
                        else if (discount > 0)
                          Text(
                            'Discount: RM ${discount.toStringAsFixed(2)}',
                            style: const TextStyle(
                              color: Color(0xFF6B1A5B),
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                      ],
                    ),
                  ),
                ),

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10.0),
                child: Divider(color: Color(0xFFE5E7EB), thickness: 1),
              ),

              // Order Items
              PromotionalGiftNotice(items: promotionalItems),
              Column(
                key: const Key('standard-order-items'),
                crossAxisAlignment: CrossAxisAlignment.start,
                children: standardItems
                    .map((item) => _buildOrderItem(item, darkGreen))
                    .toList(),
              ),

              const SizedBox(height: 6.0),

              // Compact Action Row
              Row(
                children: [
                  OutlinedButton.icon(
                    onPressed: isPrintLoading ? null : onPrintPressed,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: darkGreen,
                      side: const BorderSide(color: darkGreen, width: 1.2),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 11,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                    ),
                    icon: isPrintLoading
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: darkGreen,
                            ),
                          )
                        : const Icon(Icons.print_outlined, size: 18),
                    label: Text(
                      isHistory
                          ? 'Reprint itemised receipt'
                          : 'Print itemised receipt',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (!isHistory &&
                      !isReadyForPickup &&
                      onCancelPressed != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: cancelTooltip,
                      onPressed: isActionLoading ? null : onCancelPressed,
                      style: IconButton.styleFrom(
                        foregroundColor: const Color(0xFF9B2C2C),
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        backgroundColor: const Color(0xFFFEF2F2),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      icon: const Icon(Icons.close_rounded, size: 19),
                    ),
                  ],
                  if (!isHistory && !isReadyForPickup) ...[
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: isActionLoading ? null : onActionPressed,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: isPreparing
                              ? const Color(0xFF2E5E58)
                              : darkGreen,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10.0),
                          ),
                          elevation: 0,
                        ),
                        child: isActionLoading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                isManualPaymentPending
                                    ? 'Payment Received'
                                    : (isPreparing
                                          ? 'Mark as Ready'
                                          : 'Start Preparing'),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderItem(OrderItem item, Color darkGreen) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: Colors.black,
            ),
          ),
          if (item.tags.isNotEmpty) ...[
            const SizedBox(height: 5.0),
            Wrap(
              spacing: 5.0,
              runSpacing: 5.0,
              children: item.tags
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8.0,
                        vertical: 4.0,
                      ),
                      decoration: BoxDecoration(
                        color: darkGreen.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(7.0),
                        border: Border.all(
                          color: darkGreen.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          color: darkGreen,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }
}
