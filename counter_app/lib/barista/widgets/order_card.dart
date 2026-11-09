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
  final String customerDetails;
  final List<OrderItem> items;
  String? cancellationRequestStatus;
  final String? voucherName;
  final String? voucherType;
  final double discount;

  CurrentOrder({
    required this.status,
    required this.orderId,
    required this.timeDate,
    required this.orderDate,
    required this.customerDetails,
    required this.items,
    this.cancellationRequestStatus,
    this.voucherName,
    this.voucherType,
    this.discount = 0,
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
  final bool isActionLoading;
  final bool isPrintLoading;
  final String? cancellationRequestStatus;
  final String? voucherName;
  final String? voucherType;
  final double discount;

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
    this.isActionLoading = false,
    this.isPrintLoading = false,
    this.cancellationRequestStatus,
    this.voucherName,
    this.voucherType,
    this.discount = 0,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);

    final bool isPreparing = status == OrderStatus.preparing;
    final bool isReadyForPickup = status == OrderStatus.readyForPickup;
    final bool isHistory = status == OrderStatus.completed;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18.0),
          border: Border.all(
            color: const Color(0xFF203E32).withValues(alpha: 0.12),
            width: 1.0,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                            horizontal: 16.0,
                            vertical: 4.0,
                          ),
                          decoration: BoxDecoration(
                            color: darkGreen,
                            borderRadius: BorderRadius.circular(20.0),
                          ),
                          child: Text(
                            isReadyForPickup
                                ? 'Ready for pickup'
                                : isPreparing
                                ? 'Preparing'
                                : 'New',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8.0),
              if (cancellationRequestStatus == 'pending' ||
                  cancellationRequestStatus == 'refund_pending')
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF4D6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    cancellationRequestStatus == 'refund_pending'
                        ? 'Cancellation approved — refund pending; do not prepare'
                        : 'Cancellation requested — review before preparing',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF8A5A00),
                    ),
                  ),
                ),

              // Order ID & Chevron
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (isHistory)
                    const Icon(
                      Icons.chevron_right,
                      size: 32,
                      color: Colors.black,
                    ),
                ],
              ),

              // Customer Details
              Hero(
                tag: 'hero_customer_$orderId',
                child: Material(
                  color: Colors.transparent,
                  child: Text(
                    customerDetails,
                    style: TextStyle(
                      color: const Color(0xFF203E32).withValues(alpha: 0.65),
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              if (voucherName != null && voucherName!.trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Voucher: ${voucherName!.trim()}${discount > 0 ? ' • Discount RM ${discount.toStringAsFixed(2)}' : ''}',
                    style: const TextStyle(
                      color: Color(0xFF6B1A5B),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),

              const Padding(
                padding: EdgeInsets.symmetric(vertical: 12.0),
                child: Divider(color: Colors.grey, thickness: 0.5),
              ),

              // Order Items
              ...items.map((item) => _buildOrderItem(item, darkGreen)),

              const SizedBox(height: 8.0),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: isPrintLoading ? null : onPrintPressed,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: darkGreen,
                    side: const BorderSide(color: darkGreen, width: 1.4),
                    padding: const EdgeInsets.symmetric(vertical: 13.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.0),
                    ),
                  ),
                  icon: isPrintLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.3,
                            color: darkGreen,
                          ),
                        )
                      : const Icon(Icons.print_outlined),
                  label: Text(
                    isHistory ? 'Reprint receipt' : 'Print receipt',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),

              // Action Button (Only if not history or ready)
              if (!isHistory && !isReadyForPickup) ...[
                const SizedBox(height: 16.0),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: isActionLoading ? null : onActionPressed,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isPreparing
                          ? const Color(0xFF2E5E58)
                          : darkGreen,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14.0),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12.0),
                      ),
                      elevation: 0,
                    ),
                    child: isActionLoading
                        ? const SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              color: Colors.white,
                            ),
                          )
                        : Text(
                            isPreparing ? 'Mark as Ready' : 'Start Preparing',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrderItem(OrderItem item, Color darkGreen) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.title,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
          if (item.tags.isNotEmpty) ...[
            const SizedBox(height: 8.0),
            Wrap(
              spacing: 6.0,
              runSpacing: 6.0,
              children: item.tags
                  .map(
                    (tag) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10.0,
                        vertical: 6.0,
                      ),
                      decoration: BoxDecoration(
                        color: darkGreen.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(8.0),
                        border: Border.all(
                          color: darkGreen.withValues(alpha: 0.1),
                        ),
                      ),
                      child: Text(
                        tag,
                        style: TextStyle(
                          color: darkGreen,
                          fontSize: 12,
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
