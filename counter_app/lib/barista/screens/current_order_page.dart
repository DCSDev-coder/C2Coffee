import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:counter_app/widgets/top_notice.dart';
import '../main.dart';
import '../widgets/order_card.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';
import 'order_details_page.dart';
import '../services/api_service.dart';
import '../order_queue_partition.dart';

class CurrentOrderPage extends StatefulWidget {
  final VoidCallback? onSettingsTap;

  const CurrentOrderPage({super.key, this.onSettingsTap});

  @override
  State<CurrentOrderPage> createState() => _CurrentOrderPageState();
}

enum _OrderQueueFilter { all, newOrders, preparing, ready }

class _CurrentOrderPageState extends State<CurrentOrderPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Set<String> _updatingOrderIds = <String>{};
  final Set<String> _printingOrderIds = <String>{};
  _OrderQueueFilter _stageFilter = _OrderQueueFilter.all;
  bool _gridView = true;

  Future<void> _refreshOrders() async {
    final result = await ApiService.fetchOrders();
    if (!result.isSuccess) {
      globalOrderSyncError.value = result.errorMessage;
      return;
    }

    final partition = partitionTodayOrders(result.orders);
    globalCurrentOrders.value = partition.active;
    globalHistoryOrders.value = partition.history;
    globalOrderSyncError.value = null;
    globalLastOrderSync.value = DateTime.now();
  }

  Future<void> _startPreparing(CurrentOrder order) async {
    if (_updatingOrderIds.contains(order.orderId)) return;
    setState(() => _updatingOrderIds.add(order.orderId));

    final result = await ApiService.updateOrderStatus(
      order.orderId,
      'preparing',
    );
    if (!mounted) return;

    setState(() => _updatingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }

    order.status = OrderStatus.preparing;
    globalCurrentOrders.value = List<CurrentOrder>.from(
      globalCurrentOrders.value,
    );
  }

  Future<void> _confirmPayment(CurrentOrder order) async {
    if (_updatingOrderIds.contains(order.orderId)) return;
    final confirmation = await showDialog<_PaymentConfirmation>(
      context: context,
      builder: (context) => _PaymentConfirmationDialog(order: order),
    );
    if (confirmation == null || !mounted) return;
    setState(() => _updatingOrderIds.add(order.orderId));
    final method = order.paymentMethod == 'manual_counter'
        ? 'manual_counter'
        : order.paymentMethod == 'manual_terminal'
        ? 'manual_terminal'
        : 'manual_cash';
    final result = await ApiService.confirmManualPayment(
      order.orderId,
      method,
      discountPercent: confirmation.discountPercent,
      discountRemarks: confirmation.discountRemarks,
    );
    if (!mounted) return;
    setState(() => _updatingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    await _refreshOrders();
    if (!mounted) return;
    final finalTotal = result.data?['final_total_rm']?.toString();
    TopNotice.success(
      context,
      finalTotal == null
          ? 'Payment received. Order is ready to prepare.'
          : 'Payment received: RM $finalTotal. Order is ready to prepare.',
    );
  }

  Future<void> _cancelOrder(CurrentOrder order) async {
    if (_updatingOrderIds.contains(order.orderId)) return;
    final confirmed =
        await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Cancel this order?'),
            content: Text(
              order.paymentStatus == 'paid'
                  ? 'The order will be cancelled and a direct-payment refund will be opened for staff processing.'
                  : 'The unpaid order will be cancelled and its stock reservation released.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Keep order'),
              ),
              FilledButton.tonal(
                onPressed: () => Navigator.pop(context, true),
                style: FilledButton.styleFrom(
                  foregroundColor: const Color(0xFF9B2C2C),
                ),
                child: const Text('Cancel order'),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    setState(() => _updatingOrderIds.add(order.orderId));
    final result = await ApiService.cancelOrder(order.orderId);
    if (!mounted) return;
    setState(() => _updatingOrderIds.remove(order.orderId));
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    await _refreshOrders();
    if (mounted) {
      TopNotice.success(
        context,
        result.data?['refund_pending'] == true
            ? 'Order cancelled. Refund is pending.'
            : 'Order cancelled.',
      );
    }
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
    TopNotice.info(context, 'Receipt queued for printing.');
  }

  void _openOrderDetails(CurrentOrder order) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) =>
            OrderDetailsPage(
              orderId: order.orderId,
              customerDetails: order.customerDetails,
              items: order.items,
              onSettingsTap: widget.onSettingsTap,
            ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          const begin = Offset(1.0, 0.0);
          const end = Offset.zero;
          final tween = Tween(
            begin: begin,
            end: end,
          ).chain(CurveTween(curve: Curves.easeOutCubic));
          return SlideTransition(
            position: animation.drive(tween),
            child: child,
          );
        },
      ),
    );
  }

  Widget _buildOrderCard(CurrentOrder order) {
    return OrderCard(
      timeDate: order.timeDate,
      status: order.status,
      orderId: order.orderId,
      customerDetails: order.customerDetails,
      items: order.items,
      voucherName: order.voucherName,
      voucherType: order.voucherType,
      discount: order.discount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      cancellationRequestStatus: order.cancellationRequestStatus,
      isActionLoading: _updatingOrderIds.contains(order.orderId),
      isPrintLoading: _printingOrderIds.contains(order.orderId),
      onPrintPressed: () => _printReceipt(order),
      onCancelPressed:
          order.paymentStatus == 'pending' ||
              (order.status == OrderStatus.newOrder &&
                  order.orderChannel == 'counter' &&
                  order.paymentStatus == 'paid')
          ? () => _cancelOrder(order)
          : null,
      onActionPressed: () {
        if (order.paymentStatus == 'pending' &&
            (order.paymentMethod == 'manual_counter' ||
                order.paymentMethod == 'manual_terminal' ||
                order.paymentMethod == 'manual_cash')) {
          _confirmPayment(order);
        } else if (order.status == OrderStatus.newOrder &&
            order.cancellationRequestStatus == null &&
            order.paymentStatus != 'pending') {
          _startPreparing(order);
        } else {
          _openOrderDetails(order);
        }
      },
      onTap: () => _openOrderDetails(order),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<List<CurrentOrder>>(
      valueListenable: globalCurrentOrders,
      builder: (context, allOrders, _) {
        final newCount = allOrders
            .where((o) => o.status == OrderStatus.newOrder)
            .length;
        final preparingCount = allOrders
            .where((o) => o.status == OrderStatus.preparing)
            .length;
        final readyCount = allOrders
            .where((o) => o.status == OrderStatus.readyForPickup)
            .length;

        final filteredOrders = allOrders.where((order) {
          switch (_stageFilter) {
            case _OrderQueueFilter.all:
              return true;
            case _OrderQueueFilter.newOrders:
              return order.status == OrderStatus.newOrder;
            case _OrderQueueFilter.preparing:
              return order.status == OrderStatus.preparing;
            case _OrderQueueFilter.ready:
              return order.status == OrderStatus.readyForPickup;
          }
        }).toList();

        return Scaffold(
          backgroundColor: Colors.white,
          body: Stack(
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1240),
                  child: Container(
                    color: Colors.white,
                    child: RefreshIndicator(
                      color: darkGreen,
                      onRefresh: _refreshOrders,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              BaristaPageHeader(
                                title: 'Current Order',
                                subtitle:
                                    'Live order queue for preparation and customer pickup.',
                                onRefresh: _refreshOrders,
                                refreshTooltip: 'Refresh orders',
                                bottom: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 4,
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
                                        '${allOrders.length} active orders',
                                        style: const TextStyle(
                                          color: Color(0xFF203E32),
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    ValueListenableBuilder<DateTime?>(
                                      valueListenable: globalLastOrderSync,
                                      builder: (context, lastSync, _) {
                                        if (lastSync == null) {
                                          return const SizedBox.shrink();
                                        }
                                        final hour = lastSync.hour
                                            .remainder(12)
                                            .toString()
                                            .padLeft(2, '0');
                                        final minute = lastSync.minute
                                            .toString()
                                            .padLeft(2, '0');
                                        final suffix = lastSync.hour >= 12
                                            ? 'PM'
                                            : 'AM';
                                        return Text(
                                          'Updated $hour:$minute $suffix',
                                          style: TextStyle(
                                            color: const Color(
                                              0xFF203E32,
                                            ).withValues(alpha: 0.62),
                                            fontSize: 13,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18.0),
                              ValueListenableBuilder<String?>(
                                valueListenable: globalOrderSyncError,
                                builder: (context, syncError, _) {
                                  if (syncError == null) {
                                    return const SizedBox.shrink();
                                  }
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 16),
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFFF4E5),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: const Color(0xFFD3B17D),
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.cloud_off_outlined,
                                          color: Color(0xFF8A5A13),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            '$syncError Showing the last successful queue.',
                                          ),
                                        ),
                                        TextButton(
                                          onPressed: _refreshOrders,
                                          child: const Text('Retry'),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                alignment: WrapAlignment.spaceBetween,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      for (final entry in [
                                        (
                                          _OrderQueueFilter.all,
                                          'All (${allOrders.length})',
                                        ),
                                        (
                                          _OrderQueueFilter.newOrders,
                                          'New ($newCount)',
                                        ),
                                        (
                                          _OrderQueueFilter.preparing,
                                          'Preparing ($preparingCount)',
                                        ),
                                        (
                                          _OrderQueueFilter.ready,
                                          'Ready ($readyCount)',
                                        ),
                                      ])
                                        ChoiceChip(
                                          label: Text(entry.$2),
                                          selected: _stageFilter == entry.$1,
                                          onSelected: (_) => setState(
                                            () => _stageFilter = entry.$1,
                                          ),
                                        ),
                                    ],
                                  ),
                                  SegmentedButton<bool>(
                                    segments: const [
                                      ButtonSegment(
                                        value: true,
                                        icon: Icon(
                                          Icons.grid_view_rounded,
                                          size: 18,
                                        ),
                                        label: Text('Board'),
                                      ),
                                      ButtonSegment(
                                        value: false,
                                        icon: Icon(
                                          Icons.view_agenda_outlined,
                                          size: 18,
                                        ),
                                        label: Text('List'),
                                      ),
                                    ],
                                    selected: {_gridView},
                                    onSelectionChanged: (selection) => setState(
                                      () => _gridView = selection.first,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (filteredOrders.isEmpty)
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
                                          Icons.shopping_basket_outlined,
                                          size: 48,
                                          color: const Color(
                                            0xFF203E32,
                                          ).withValues(alpha: 0.25),
                                        ),
                                        const SizedBox(height: 14),
                                        const Text(
                                          'No orders found.',
                                          style: TextStyle(
                                            color: Color(0xFF203E32),
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          _stageFilter == _OrderQueueFilter.all
                                              ? 'New incoming orders will appear here automatically.'
                                              : 'Try switching to All to see other orders.',
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
                              else if (!_gridView)
                                ...filteredOrders.map(_buildOrderCard)
                              else
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    final columns = constraints.maxWidth >= 1020
                                        ? 3
                                        : constraints.maxWidth >= 660
                                        ? 2
                                        : 1;
                                    if (columns == 1) {
                                      return Column(
                                        children: filteredOrders
                                            .map(_buildOrderCard)
                                            .toList(),
                                      );
                                    }
                                    const spacing = 14.0;
                                    final cardWidth =
                                        (constraints.maxWidth -
                                            spacing * (columns - 1)) /
                                        columns;
                                    return Wrap(
                                      spacing: spacing,
                                      runSpacing: 2,
                                      children: [
                                        for (final order in filteredOrders)
                                          SizedBox(
                                            width: cardWidth,
                                            child: _buildOrderCard(order),
                                          ),
                                      ],
                                    );
                                  },
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _PaymentConfirmation {
  const _PaymentConfirmation({this.discountPercent, this.discountRemarks});

  final double? discountPercent;
  final String? discountRemarks;
}

class _PaymentConfirmationDialog extends StatefulWidget {
  const _PaymentConfirmationDialog({required this.order});

  final CurrentOrder order;

  @override
  State<_PaymentConfirmationDialog> createState() =>
      _PaymentConfirmationDialogState();
}

class _PaymentConfirmationDialogState
    extends State<_PaymentConfirmationDialog> {
  final _formKey = GlobalKey<FormState>();
  final _percentController = TextEditingController();
  final _remarksController = TextEditingController();
  bool _applyDiscount = false;

  double? get _percent => double.tryParse(_percentController.text.trim());

  double get _discountAmount {
    final percent = _percent;
    if (!_applyDiscount || percent == null) return 0;
    return (widget.order.total * percent / 100 * 100).round() / 100;
  }

  @override
  void dispose() {
    _percentController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    Navigator.pop(
      context,
      _PaymentConfirmation(
        discountPercent: _applyDiscount ? _percent : null,
        discountRemarks: _applyDiscount ? _remarksController.text.trim() : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final finalTotal = (widget.order.total - _discountAmount).clamp(
      0,
      double.infinity,
    );
    final hasVoucher = widget.order.voucherName?.trim().isNotEmpty == true;
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 580),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 18, 22, 16),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Confirm counter payment',
                            style: Theme.of(context).textTheme.titleLarge
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Order ${widget.order.orderId}  •  Total: RM ${widget.order.total.toStringAsFixed(2)}',
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: Colors.black54),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Theme.of(
                          context,
                        ).colorScheme.primaryContainer.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        'Collect RM ${finalTotal.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: Theme.of(
                            context,
                          ).colorScheme.onPrimaryContainer,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                SwitchListTile.adaptive(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: const Text(
                    'Apply card promotion discount',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                  subtitle: Text(
                    hasVoucher
                        ? 'Unavailable because this order already uses a voucher.'
                        : 'Use only after checking the customer\'s eligible card.',
                  ),
                  value: _applyDiscount,
                  onChanged: hasVoucher
                      ? null
                      : (value) => setState(() => _applyDiscount = value),
                ),
                if (_applyDiscount) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Text(
                        'Quick %:',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.black54,
                        ),
                      ),
                      for (final preset in const ['10', '15', '20', '25'])
                        ChoiceChip(
                          label: Text('$preset%'),
                          visualDensity: VisualDensity.compact,
                          selected: _percentController.text.trim() == preset,
                          onSelected: (_) {
                            setState(() {
                              _percentController.text = preset;
                              _percentController.selection =
                                  TextSelection.collapsed(
                                    offset: preset.length,
                                  );
                            });
                          },
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final percentField = TextFormField(
                        controller: _percentController,
                        scrollPadding: const EdgeInsets.only(bottom: 120),
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                            RegExp(r'^\d{0,3}(\.\d{0,2})?'),
                          ),
                        ],
                        decoration: const InputDecoration(
                          labelText: 'Discount %',
                          suffixText: '%',
                          hintText: '20',
                          isDense: true,
                          border: OutlineInputBorder(),
                        ),
                        onChanged: (_) => setState(() {}),
                        validator: (value) {
                          if (!_applyDiscount) return null;
                          final percent = double.tryParse(value?.trim() ?? '');
                          if (percent == null ||
                              percent <= 0 ||
                              percent > 100) {
                            return 'Enter 0.01 to 100.';
                          }
                          return null;
                        },
                      );
                      final remarksField = TextFormField(
                        controller: _remarksController,
                        scrollPadding: const EdgeInsets.only(bottom: 120),
                        maxLength: 500,
                        decoration: const InputDecoration(
                          labelText: 'Remarks',
                          hintText: 'Maybank card promotion',
                          isDense: true,
                          counterText: '',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (!_applyDiscount) return null;
                          if ((value ?? '').trim().length < 3) {
                            return 'Enter card or promotion.';
                          }
                          return null;
                        },
                      );

                      if (constraints.maxWidth >= 420) {
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: percentField),
                            const SizedBox(width: 12),
                            Expanded(flex: 3, child: remarksField),
                          ],
                        );
                      }
                      return Column(
                        children: [
                          percentField,
                          const SizedBox(height: 10),
                          remarksField,
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Discount: RM ${_discountAmount.toStringAsFixed(2)}  •  '
                    'Collect: RM ${finalTotal.toStringAsFixed(2)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: _submit,
                      child: const Text('Confirm payment'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
