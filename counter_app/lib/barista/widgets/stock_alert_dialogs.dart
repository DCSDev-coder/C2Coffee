import 'package:flutter/material.dart';
import '../services/api_service.dart';

const Color _ink = Color(0xFF203E32);
const Color _canvas = Color(0xFFF7F9F8);

/// Formats numeric strings like "500.000" -> "500" and "12.500" -> "12.5".
String formatStockQuantity(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return '0';
  final parsed = double.tryParse(trimmed);
  if (parsed == null) return trimmed;
  if (parsed == parsed.roundToDouble()) {
    return parsed.toInt().toString();
  }
  return parsed
      .toStringAsFixed(3)
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceFirst(RegExp(r'\.$'), '');
}

String _baristaActionLabel(String action) {
  switch (action) {
    case 'pending':
      return 'Awaiting response';
    case 'keep_available':
      return 'Kept available';
    case 'mark_out_of_stock':
      return 'Marked out of stock';
    default:
      return action;
  }
}

Color _baristaActionColor(String action) {
  switch (action) {
    case 'pending':
      return const Color(0xFFB45309);
    case 'keep_available':
      return const Color(0xFF15803D);
    case 'mark_out_of_stock':
      return const Color(0xFFB91C1C);
    default:
      return _ink;
  }
}

Color _baristaActionBg(String action) {
  switch (action) {
    case 'pending':
      return const Color(0xFFFEF3C7);
    case 'keep_available':
      return const Color(0xFFDCFCE7);
    case 'mark_out_of_stock':
      return const Color(0xFFFEE2E2);
    default:
      return _canvas;
  }
}

class StockAlertListDialog extends StatelessWidget {
  const StockAlertListDialog({super.key, required this.alerts});

  final List<BaristaStockAlert> alerts;

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.sizeOf(context);
    final maxHeight = (screenSize.height * 0.82).clamp(320.0, 640.0);

    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: _ink.withValues(alpha: 0.10)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 520, maxHeight: maxHeight),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _DialogHeader(
                icon: alerts.isEmpty
                    ? Icons.inventory_2_outlined
                    : Icons.notifications_active_outlined,
                iconBg: alerts.isEmpty
                    ? const Color(0xFFDCFCE7)
                    : const Color(0xFFFEF3C7),
                iconColor: alerts.isEmpty
                    ? const Color(0xFF15803D)
                    : const Color(0xFFB45309),
                title: 'Open stock alerts',
                subtitle: alerts.isEmpty
                    ? 'All tracked ingredients are above alert levels'
                    : '${alerts.length} ${alerts.length == 1 ? 'ingredient needs' : 'ingredients need'} attention · Tap an item to respond',
                onClose: () => Navigator.of(context).pop(),
              ),
              Divider(height: 1, color: _ink.withValues(alpha: 0.08)),
              Flexible(
                child: alerts.isEmpty
                    ? Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 28,
                          vertical: 40,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: const Color(0xFFDCFCE7),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(
                                Icons.check_circle_outline_rounded,
                                color: Color(0xFF15803D),
                                size: 30,
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No open stock alerts',
                              style: TextStyle(
                                color: _ink,
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'There are no open stock alerts for this outlet.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: _ink.withValues(alpha: 0.62),
                                fontSize: 14,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                        itemCount: alerts.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (context, index) => _StockAlertListTile(
                          alert: alerts[index],
                          onTap: () => Navigator.of(context).pop(alerts[index]),
                        ),
                      ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                decoration: BoxDecoration(
                  color: _canvas,
                  border: Border(
                    top: BorderSide(color: _ink.withValues(alpha: 0.08)),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _ink,
                        side: BorderSide(color: _ink.withValues(alpha: 0.22)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 12,
                        ),
                      ),
                      child: const Text(
                        'Close',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StockAlertListTile extends StatelessWidget {
  const _StockAlertListTile({required this.alert, required this.onTap});

  final BaristaStockAlert alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isEmpty = alert.alertLevel == 'empty';
    final statusColor = isEmpty
        ? const Color(0xFFB91C1C)
        : const Color(0xFFB45309);
    final statusBg = isEmpty
        ? const Color(0xFFFEE2E2)
        : const Color(0xFFFEF3C7);
    final qty = formatStockQuantity(alert.availableQuantity);
    final actionColor = _baristaActionColor(alert.baristaAction);
    final actionBg = _baristaActionBg(alert.baristaAction);

    return Material(
      color: _canvas,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: _ink.withValues(alpha: 0.09)),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  isEmpty
                      ? Icons.error_outline_rounded
                      : Icons.warning_amber_rounded,
                  color: statusColor,
                  size: 22,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      alert.inventoryItemName,
                      style: const TextStyle(
                        color: _ink,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          '$qty ${alert.unitLabel} available',
                          style: TextStyle(
                            color: _ink.withValues(alpha: 0.70),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: actionBg,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            _baristaActionLabel(alert.baristaAction),
                            style: TextStyle(
                              color: actionColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right_rounded,
                color: _ink.withValues(alpha: 0.45),
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class StockAlertActionDialog extends StatefulWidget {
  const StockAlertActionDialog({
    super.key,
    required this.alert,
    required this.onSubmit,
  });

  final BaristaStockAlert alert;
  final Future<void> Function(
    String action,
    List<int> menuItemIds,
    List<int> optionIds,
  )
  onSubmit;

  @override
  State<StockAlertActionDialog> createState() => _StockAlertActionDialogState();
}

class _StockAlertActionDialogState extends State<StockAlertActionDialog> {
  late final Set<int> _selectedMenuItemIds;
  late final Set<int> _selectedOptionIds;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _selectedMenuItemIds = widget.alert.affectedMenuItems
        .where((item) => item.isAvailable)
        .map((item) => item.id)
        .toSet();
    _selectedOptionIds = widget.alert.affectedOptions
        .where((opt) => opt.isAvailable)
        .map((opt) => opt.id)
        .toSet();
  }

  Future<void> _handleAction(String action) async {
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      await widget.onSubmit(
        action,
        _selectedMenuItemIds.toList(),
        _selectedOptionIds.toList(),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  int get _selectedCount =>
      _selectedMenuItemIds.length + _selectedOptionIds.length;

  @override
  Widget build(BuildContext context) {
    final isEmpty = widget.alert.alertLevel == 'empty';
    final statusColor = isEmpty
        ? const Color(0xFFB91C1C)
        : const Color(0xFFB45309);
    final statusBg = isEmpty
        ? const Color(0xFFFEE2E2)
        : const Color(0xFFFEF3C7);
    final headerTint = isEmpty
        ? const Color(0xFFFEF2F2)
        : const Color(0xFFFFFBEB);

    final screenSize = MediaQuery.sizeOf(context);
    final maxHeight = (screenSize.height * 0.86).clamp(360.0, 720.0);

    final availableQty = formatStockQuantity(widget.alert.availableQuantity);
    final reorderQty = formatStockQuantity(widget.alert.reorderLevel);
    final hasAffected =
        widget.alert.affectedMenuItems.isNotEmpty ||
        widget.alert.affectedOptions.isNotEmpty;

    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: _ink.withValues(alpha: 0.10)),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 540, maxHeight: maxHeight),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                color: headerTint,
                padding: const EdgeInsets.fromLTRB(22, 18, 16, 18),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        isEmpty
                            ? Icons.error_outline_rounded
                            : Icons.warning_amber_rounded,
                        color: statusColor,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: statusBg,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              isEmpty
                                  ? 'INGREDIENT OUT OF STOCK'
                                  : 'LOW STOCK WARNING',
                              style: TextStyle(
                                color: statusColor,
                                fontSize: 10,
                                letterSpacing: 0.8,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            widget.alert.inventoryItemName,
                            style: const TextStyle(
                              color: _ink,
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _submitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      tooltip: 'Close',
                      icon: Icon(
                        Icons.close_rounded,
                        color: _ink.withValues(alpha: 0.65),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: _ink.withValues(alpha: 0.08)),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: _MetricTile(
                              label: 'AVAILABLE',
                              value: '$availableQty ${widget.alert.unitLabel}',
                              valueColor: statusColor,
                              backgroundColor: headerTint,
                              borderColor: statusColor.withValues(alpha: 0.20),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _MetricTile(
                              label: 'ALERT LEVEL',
                              value: '$reorderQty ${widget.alert.unitLabel}',
                              valueColor: _ink,
                              backgroundColor: _canvas,
                              borderColor: _ink.withValues(alpha: 0.09),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: _canvas,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _ink.withValues(alpha: 0.08),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.info_outline_rounded,
                              size: 18,
                              color: _ink.withValues(alpha: 0.65),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Nothing is turned off automatically. Select any affected menu items or options to mark them out of stock.',
                                style: TextStyle(
                                  fontSize: 13,
                                  height: 1.4,
                                  color: _ink.withValues(alpha: 0.78),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!hasAffected) ...[
                        const SizedBox(height: 16),
                        Text(
                          'No menu items or options are linked to this ingredient.',
                          style: TextStyle(
                            fontSize: 13,
                            color: _ink.withValues(alpha: 0.60),
                          ),
                        ),
                      ],
                      if (widget.alert.affectedMenuItems.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _SectionHeader(
                          title: 'AFFECTED MENU ITEMS',
                          count: widget.alert.affectedMenuItems.length,
                          allSelected: widget.alert.affectedMenuItems.every(
                            (item) => _selectedMenuItemIds.contains(item.id),
                          ),
                          onToggleAll: _submitting
                              ? null
                              : () {
                                  setState(() {
                                    final allSelected = widget
                                        .alert
                                        .affectedMenuItems
                                        .every(
                                          (item) => _selectedMenuItemIds
                                              .contains(item.id),
                                        );
                                    if (allSelected) {
                                      _selectedMenuItemIds.clear();
                                    } else {
                                      _selectedMenuItemIds.addAll(
                                        widget.alert.affectedMenuItems.map(
                                          (item) => item.id,
                                        ),
                                      );
                                    }
                                  });
                                },
                        ),
                        const SizedBox(height: 8),
                        ...widget.alert.affectedMenuItems.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _SelectableItemRow(
                              title: item.name,
                              isAvailable: item.isAvailable,
                              selected: _selectedMenuItemIds.contains(item.id),
                              enabled: !_submitting,
                              onChanged: (checked) {
                                setState(() {
                                  if (checked) {
                                    _selectedMenuItemIds.add(item.id);
                                  } else {
                                    _selectedMenuItemIds.remove(item.id);
                                  }
                                });
                              },
                            ),
                          ),
                        ),
                      ],
                      if (widget.alert.affectedOptions.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        _SectionHeader(
                          title: 'AFFECTED OPTIONS',
                          count: widget.alert.affectedOptions.length,
                          allSelected: widget.alert.affectedOptions.every(
                            (opt) => _selectedOptionIds.contains(opt.id),
                          ),
                          onToggleAll: _submitting
                              ? null
                              : () {
                                  setState(() {
                                    final allSelected = widget
                                        .alert
                                        .affectedOptions
                                        .every(
                                          (opt) => _selectedOptionIds.contains(
                                            opt.id,
                                          ),
                                        );
                                    if (allSelected) {
                                      _selectedOptionIds.clear();
                                    } else {
                                      _selectedOptionIds.addAll(
                                        widget.alert.affectedOptions.map(
                                          (opt) => opt.id,
                                        ),
                                      );
                                    }
                                  });
                                },
                        ),
                        const SizedBox(height: 8),
                        ...widget.alert.affectedOptions.map(
                          (opt) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _SelectableItemRow(
                              title: '${opt.groupName}: ${opt.optionName}',
                              isAvailable: opt.isAvailable,
                              selected: _selectedOptionIds.contains(opt.id),
                              enabled: !_submitting,
                              onChanged: (checked) {
                                setState(() {
                                  if (checked) {
                                    _selectedOptionIds.add(opt.id);
                                  } else {
                                    _selectedOptionIds.remove(opt.id);
                                  }
                                });
                              },
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
                decoration: BoxDecoration(
                  color: _canvas,
                  border: Border(
                    top: BorderSide(color: _ink.withValues(alpha: 0.08)),
                  ),
                ),
                child: Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    TextButton(
                      onPressed: _submitting
                          ? null
                          : () => Navigator.of(context).pop(),
                      style: TextButton.styleFrom(
                        foregroundColor: _ink.withValues(alpha: 0.72),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                      ),
                      child: const Text(
                        'Close',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    OutlinedButton(
                      onPressed: _submitting
                          ? null
                          : () => _handleAction('keep_available'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: _ink,
                        side: BorderSide(color: _ink.withValues(alpha: 0.24)),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                      ),
                      child: const Text(
                        'Keep available',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                    FilledButton(
                      onPressed: _submitting || _selectedCount == 0
                          ? null
                          : () => _handleAction('mark_out_of_stock'),
                      style: FilledButton.styleFrom(
                        backgroundColor: _ink,
                        disabledBackgroundColor: _ink.withValues(alpha: 0.25),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 12,
                        ),
                      ),
                      child: Text(
                        _submitting
                            ? 'Updating...'
                            : _selectedCount > 0
                            ? 'Mark out of stock ($_selectedCount)'
                            : 'Mark selected out of stock',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DialogHeader extends StatelessWidget {
  const _DialogHeader({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onClose,
  });

  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 18, 14, 16),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: _ink,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: _ink.withValues(alpha: 0.62),
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onClose,
            tooltip: 'Close',
            icon: Icon(Icons.close_rounded, color: _ink.withValues(alpha: 0.6)),
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.backgroundColor,
    required this.borderColor,
  });

  final String label;
  final String value;
  final Color valueColor;
  final Color backgroundColor;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: _ink.withValues(alpha: 0.54),
              fontSize: 10,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.title,
    required this.count,
    required this.allSelected,
    required this.onToggleAll,
  });

  final String title;
  final int count;
  final bool allSelected;
  final VoidCallback? onToggleAll;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          '$title ($count)',
          style: TextStyle(
            color: _ink.withValues(alpha: 0.54),
            fontSize: 11,
            letterSpacing: 1.2,
            fontWeight: FontWeight.w800,
          ),
        ),
        const Spacer(),
        if (count > 1)
          TextButton(
            onPressed: onToggleAll,
            style: TextButton.styleFrom(
              foregroundColor: _ink,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              allSelected ? 'Clear all' : 'Select all',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

class _SelectableItemRow extends StatelessWidget {
  const _SelectableItemRow({
    required this.title,
    required this.isAvailable,
    required this.selected,
    required this.enabled,
    required this.onChanged,
  });

  final String title;
  final bool isAvailable;
  final bool selected;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? _ink.withValues(alpha: 0.05) : _canvas,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? () => onChanged(!selected) : null,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected
                  ? _ink.withValues(alpha: 0.35)
                  : _ink.withValues(alpha: 0.09),
            ),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 22,
                height: 22,
                child: Checkbox(
                  value: selected,
                  onChanged: enabled ? (v) => onChanged(v ?? false) : null,
                  activeColor: _ink,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    color: _ink,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              if (!isAvailable) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text(
                    'Out of stock',
                    style: TextStyle(
                      color: Color(0xFFB91C1C),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
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
}
