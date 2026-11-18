import 'package:flutter/material.dart';

enum OrderStatus { newOrder, preparing, readyForPickup, completed }

class OrderItem {
  final String title;
  final List<String> tags;
  final int? menuItemId;

  OrderItem({required this.title, required this.tags, this.menuItemId});
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
  final String? paymentMethod;
  final String? paymentStatus;
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
    this.paymentMethod,
    this.paymentStatus,
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
  final bool isActionLoading;
  final bool isPrintLoading;
  final String? cancellationRequestStatus;
  final String? voucherName;
  final String? voucherType;
  final double discount;
  final String? paymentMethod;
  final String? paymentStatus;
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
    this.isActionLoading = false,
    this.isPrintLoading = false,
    this.cancellationRequestStatus,
    this.voucherName,
    this.voucherType,
    this.discount = 0,
    this.paymentMethod,
    this.paymentStatus,
    this.total = 0,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);

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
                  Text(
                    'RM ${total.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Color(0xFF203E32),
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
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
              if (voucherName != null && voucherName!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Voucher: ${voucherName!.trim()}${discount > 0 ? ' • Discount RM ${discount.toStringAsFixed(2)}' : ''}',
                    style: const TextStyle(
                      color: Color(0xFF6B1A5B),
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10.0),
                child: Divider(color: Color(0xFFE5E7EB), thickness: 1),
              ),

              // Order Items
              ...items.map((item) => _buildOrderItem(item, darkGreen)),

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
                      isHistory ? 'Reprint receipt' : 'Print receipt',
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
                      tooltip: 'Cancel order',
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
