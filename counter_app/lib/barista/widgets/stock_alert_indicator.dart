import 'package:flutter/material.dart';
import '../services/api_service.dart';

List<BaristaStockAlert> stockAlertsForMenuItem(
  List<BaristaStockAlert> alerts,
  int id,
) => alerts
    .where((alert) => alert.affectedMenuItems.any((item) => item.id == id))
    .toList();

List<BaristaStockAlert> stockAlertsForOption(
  List<BaristaStockAlert> alerts,
  String type,
  String value,
) => alerts
    .where(
      (alert) => alert.affectedOptions.any(
        (option) =>
            option.customizationType == type &&
            option.customizationValue == value,
      ),
    )
    .toList();

/// A dot which also offers a tap target for devices without long press.
class StockAlertIndicator extends StatelessWidget {
  const StockAlertIndicator({
    super.key,
    required this.name,
    required this.alerts,
  });

  final String name;
  final List<BaristaStockAlert> alerts;

  static void showDetails(
    BuildContext context,
    String name,
    List<BaristaStockAlert> alerts,
  ) {
    if (alerts.isEmpty) return;
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Stock alerts for $name'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('These ingredients have open stock alerts:'),
                for (final alert in alerts)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      alert.alertLevel == 'empty'
                          ? Icons.error_outline
                          : Icons.warning_amber_rounded,
                      color: Colors.red.shade700,
                    ),
                    title: Text(alert.inventoryItemName),
                    subtitle: Text(
                      '${alert.availableQuantity} ${alert.unitLabel} available; alert level ${alert.reorderLevel} ${alert.unitLabel}',
                    ),
                  ),
                const Text(
                  'Check the availability switch before changing the item.',
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => alerts.isEmpty
      ? const SizedBox.shrink()
      : IconButton(
          tooltip: 'Show stock alerts for $name',
          visualDensity: VisualDensity.compact,
          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
          onPressed: () => showDetails(context, name, alerts),
          icon: const Icon(Icons.circle, size: 10, color: Color(0xFFE53935)),
        );
}
