import 'package:counter_app/widgets/top_notice.dart';
import 'package:flutter/material.dart';

import '../main.dart';
import '../services/api_service.dart';
import '../services/direct_printer_service.dart';
import '../widgets/order_card.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';
import 'order_details_page.dart';
import '../order_queue_partition.dart';

class OrderHistoryPage extends StatefulWidget {
  const OrderHistoryPage({super.key, this.onSettingsTap});

  final VoidCallback? onSettingsTap;

  @override
  State<OrderHistoryPage> createState() => _OrderHistoryPageState();
}

class _OrderHistoryPageState extends State<OrderHistoryPage> {
  static const _darkGreen = Color(0xFF304A3A);
  final Set<String> _printingOrderIds = <String>{};
  bool _printingShiftSummary = false;

  Future<void> _printShiftSummary() async {
    if (_printingShiftSummary) return;
    setState(() => _printingShiftSummary = true);
    try {
      final result = await ApiService.fetchShiftSummary();
      if (!mounted) return;
      if (!result.isSuccess) {
        TopNotice.error(context, result.errorMessage!);
        return;
      }
      final report = result.data?['shift_report'];
      if (report is! Map<String, dynamic>) {
        TopNotice.error(context, 'Shift summary data is unavailable.');
        return;
      }
      await DirectPrinterService.instance.printShiftSummaryReport(report);
      if (!mounted) return;
      TopNotice.success(context, 'Shift summary printed.');
    } on StateError catch (error) {
      if (mounted) TopNotice.error(context, error.message);
    } catch (error) {
      if (mounted) {
        TopNotice.error(context, 'Shift summary could not be printed: $error');
      }
    } finally {
      if (mounted) {
        setState(() => _printingShiftSummary = false);
      }
    }
  }

  Future<void> _refreshOrders() async {
    final result = await ApiService.fetchOrders();
    if (!result.isSuccess) {
      globalOrderSyncError.value = result.errorMessage;
      if (mounted) TopNotice.error(context, result.errorMessage!);
      return;
    }
    final partition = partitionTodayOrders(result.orders);
    globalCurrentOrders.value = partition.active;
    globalHistoryOrders.value = partition.history;
    globalOrderSyncError.value = null;
    globalLastOrderSync.value = DateTime.now();
  }

  Future<void> _printReceipt(CurrentOrder order) async {
    if (_printingOrderIds.contains(order.orderId)) return;
    setState(() => _printingOrderIds.add(order.orderId));
    final result = await ApiService.queueReceiptReprint(order.orderId);
    if (!mounted) return;
    setState(() => _printingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    TopNotice.info(context, 'Itemised receipt queued for printing.');
  }

  void _openOrder(CurrentOrder order) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => OrderDetailsPage(
          orderId: order.orderId,
          customerDetails: order.customerDetails,
          items: order.items,
          isHistory: true,
          onSettingsTap: widget.onSettingsTap,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalHistoryOrders,
      builder: (context, orders, _) {
        final newestFirst = orders.reversed.toList();
        return Scaffold(
          backgroundColor: Colors.white,
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1120),
              child: Container(
                color: Colors.white,
                child: RefreshIndicator(
                  color: _darkGreen,
                  onRefresh: _refreshOrders,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                    children: [
                      BaristaPageHeader(
                        title: 'Order History',
                        subtitle:
                            "Completed and finished orders for today's shift.",
                        onRefresh: _refreshOrders,
                        refreshTooltip: 'Refresh history',
                        bottom: Wrap(
                          spacing: 10,
                          runSpacing: 8,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(
                                  0xFF203E32,
                                ).withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: const Color(
                                    0xFF203E32,
                                  ).withValues(alpha: 0.12),
                                ),
                              ),
                              child: Text(
                                '${newestFirst.length} finished orders today',
                                style: const TextStyle(
                                  color: Color(0xFF203E32),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            OutlinedButton.icon(
                              onPressed: _printingShiftSummary
                                  ? null
                                  : _printShiftSummary,
                              icon: _printingShiftSummary
                                  ? const SizedBox.square(
                                      dimension: 15,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.print_rounded, size: 17),
                              label: Text(
                                _printingShiftSummary
                                    ? 'Printing...'
                                    : 'Print Shift Summary',
                              ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: _darkGreen,
                                side: BorderSide(
                                  color: _darkGreen.withValues(alpha: 0.35),
                                ),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 8,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                textStyle: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 22),
                      const BaristaSectionLabel(
                        label: "TODAY'S FINISHED ORDERS",
                      ),
                      const SizedBox(height: 12),
                      if (newestFirst.isEmpty)
                        BaristaCard(
                          padding: const EdgeInsets.symmetric(
                            vertical: 48,
                            horizontal: 24,
                          ),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.history_rounded,
                                  size: 48,
                                  color: const Color(
                                    0xFF203E32,
                                  ).withValues(alpha: 0.25),
                                ),
                                const SizedBox(height: 14),
                                const Text(
                                  'No finished orders yet today.',
                                  style: TextStyle(
                                    color: Color(0xFF203E32),
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Orders marked completed will appear in this history log.',
                                  style: TextStyle(
                                    color: const Color(
                                      0xFF203E32,
                                    ).withValues(alpha: 0.6),
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else
                        ...newestFirst.map(
                          (order) => OrderCard(
                            timeDate: order.timeDate,
                            status: order.status,
                            orderId: order.orderId,
                            customerDetails: order.customerDetails,
                            items: order.items,
                            voucherName: order.voucherName,
                            voucherType: order.voucherType,
                            discount: order.discount,
                            voucherDiscountTokens: order.voucherDiscountTokens,
                            voucherRewardSummary: order.voucherRewardSummary,
                            paymentMethod: order.paymentMethod,
                            paymentStatus: order.paymentStatus,
                            paymentMode: order.paymentMode,
                            tokenAmountCharged: order.tokenAmountCharged,
                            subsidyTokenAmount: order.subsidyTokenAmount,
                            isEmployee: order.isEmployee,
                            subsidyRole: order.subsidyRole,
                            total: order.total,
                            cancellationRequestStatus:
                                order.cancellationRequestStatus,
                            isPrintLoading: _printingOrderIds.contains(
                              order.orderId,
                            ),
                            onPrintPressed: () => _printReceipt(order),
                            onTap: () => _openOrder(order),
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
