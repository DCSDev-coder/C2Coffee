import 'package:flutter/material.dart';

enum OrderStatus { newOrder, preparing, completed }

class OrderItem {
  final String title;
  final List<String> tags;

  OrderItem({required this.title, required this.tags});
}

class OrderCard extends StatelessWidget {
  final String timeDate;
  final OrderStatus status;
  final String orderId;
  final String customerDetails;
  final List<OrderItem> items;
  final VoidCallback? onActionPressed;
  final VoidCallback? onTap;

  const OrderCard({
    super.key,
    required this.timeDate,
    required this.status,
    required this.orderId,
    required this.customerDetails,
    required this.items,
    this.onActionPressed,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const Color darkGreen = Color(0xFF304A3A);
    const Color orangeColor = Color(0xFFDE7D66);
    const Color beigeColor = Color(0xFFD3B17D);

    final bool isPreparing = status == OrderStatus.preparing;
    final bool isHistory = status == OrderStatus.completed;
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24.0),
          border: Border.all(color: darkGreen, width: 1.5),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20.0),
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
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
                    decoration: BoxDecoration(
                      color: darkGreen,
                      borderRadius: BorderRadius.circular(20.0),
                    ),
                    child: Text(
                      isPreparing ? 'Preparing' : 'New',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8.0),
            
            // Order ID & Chevron
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  orderId,
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
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
            Text(
              customerDetails,
              style: const TextStyle(
                color: beigeColor,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12.0),
              child: Divider(color: Colors.grey, thickness: 0.5),
            ),
            
            // Order Items
            ...items.map((item) => _buildOrderItem(item, darkGreen)).toList(),
            
            // Action Button (Only if not history)
            if (!isHistory) ...[
              const SizedBox(height: 16.0),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onActionPressed,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isPreparing ? orangeColor : beigeColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.0),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
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
    const int maxTags = 3;
    final List<String> displayedTags = item.tags.take(maxTags).toList();
    final int extraTagsCount = item.tags.length > maxTags ? item.tags.length - maxTags : 0;

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
              children: [
                ...displayedTags.map((tag) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
                  decoration: BoxDecoration(
                    color: darkGreen.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(8.0),
                    border: Border.all(color: darkGreen.withOpacity(0.1)),
                  ),
                  child: Text(
                    tag,
                    style: TextStyle(
                      color: darkGreen,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )),
                if (extraTagsCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10.0, vertical: 6.0),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8.0),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Text(
                      '+$extraTagsCount more',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
