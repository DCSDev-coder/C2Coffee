import 'package:flutter/material.dart';

import '../services/app_session_service.dart';
import '../services/customer_data_service.dart';
import '../services/order_reorder_service.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/catalog_product_image.dart';
import 'loading_order_page.dart';

class OrderDetailsPage extends StatelessWidget {
  final CustomerOrder order;

  const OrderDetailsPage({super.key, required this.order});

  String? _resolveOrderImageUrl() {
    final allMenuItems = AppSessionService.instance.allMenuItems;
    for (final orderItem in order.items) {
      for (final menuItem in allMenuItems) {
        if (menuItem.id != orderItem.menuItemId) continue;
        final imageUrl = menuItem.imageUrl?.trim();
        if (imageUrl != null && imageUrl.isNotEmpty) {
          return imageUrl;
        }
      }
    }
    return null;
  }

  String _displayName() {
    final primaryTitle = order.primaryItemName?.trim();
    if (primaryTitle != null && primaryTitle.isNotEmpty) {
      return primaryTitle;
    }

    final itemTitle = order.items.isNotEmpty ? order.items.first.name.trim() : '';
    if (itemTitle.isNotEmpty) {
      return itemTitle;
    }

    return order.orderRef.isNotEmpty ? order.orderRef : 'Order ${order.id}';
  }

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'pm' : 'am';
    return '${local.day.toString().padLeft(2, '0')}/${local.month.toString().padLeft(2, '0')}/${local.year} · $hour:$minute $period';
  }

  String _buildDetails() {
    if (order.items.isEmpty) {
      return 'No item details available.';
    }

    final buffer = StringBuffer();
    for (final item in order.items) {
      if (buffer.isNotEmpty) buffer.writeln();
      buffer.write('${item.quantity}x ${item.name}');

      final modifierLabels = item.modifiers
          .map((modifier) => modifier.optionName.trim())
          .where((value) => value.isNotEmpty)
          .toList();
      if (modifierLabels.isNotEmpty) {
        buffer.write(' / ${modifierLabels.join(' / ')}');
      }
    }
    return buffer.toString();
  }

  Future<void> _handleOrderAgain(BuildContext context) async {
    await OrderReorderService.instance.reorderOrder(context, order);
  }

  void _navigateBack(BuildContext context) {
    InteractiveFillingLoader.showPop(context);
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = _resolveOrderImageUrl();
    final firstItem = order.items.isNotEmpty ? order.items.first : null;
    final totalItems = order.itemCount > 0 ? order.itemCount : order.items.length;
    final totalLabel = totalItems > 0 ? '$totalItems item${totalItems == 1 ? '' : 's'}' : '0 items';
    const Color bgColor = Colors.white;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _navigateBack(context);
      },
      child: AppPageShell(
        title: 'ORDER DETAILS',
        onBack: () => _navigateBack(context),
        backgroundColor: bgColor,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: AppColors.border,
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CatalogProductImage(
                          imageUrl: imageUrl,
                          width: 70,
                          height: 92,
                          fit: BoxFit.contain,
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _formatDateTime(order.createdAt),
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 12,
                                  color: Colors.black54,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Text(
                                      _displayName(),
                                      style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 20,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.deepTeal,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Text(
                                    'x${totalItems > 0 ? totalItems : 1}',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 22,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.deepTeal,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                _buildDetails(),
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black87,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'Store: ${order.store.name}',
                                style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black87,
                                ),
                              ),
                              if (firstItem != null) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Order Ref: ${order.orderRef}',
                                  style: const TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14,
                                    color: Colors.black54,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          totalLabel,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          'RM${double.tryParse(order.finalTotalRm)?.toStringAsFixed(2) ?? order.finalTotalRm}',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: () => _handleOrderAgain(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.surfaceLight,
                    foregroundColor: AppColors.deepTeal,
                    side: BorderSide(color: AppColors.border),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(25),
                    ),
                  ),
                  child: const Text(
                    'Order Again',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
