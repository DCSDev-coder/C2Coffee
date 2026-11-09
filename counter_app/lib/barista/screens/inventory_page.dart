import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../../widgets/top_notice.dart';

class InventoryPage extends StatefulWidget {
  const InventoryPage({super.key});
  @override
  State<InventoryPage> createState() => _InventoryPageState();
}

class _InventoryPageState extends State<InventoryPage> {
  BaristaInventoryResult? _inventory;
  bool _loading = true;
  bool _isWaste = false;
  BaristaInventoryItem? _selected;
  final _quantity = TextEditingController();
  final _note = TextEditingController();
  String _reason = 'expired';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _quantity.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final value = await ApiService.fetchBaristaInventory();
      if (mounted) {
        setState(() {
          _inventory = value;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _loading = false);
        TopNotice.error(
          context,
          error.toString().replaceFirst('Bad state: ', ''),
        );
      }
    }
  }

  Future<void> _submit() async {
    final quantity = double.tryParse(_quantity.text.trim());
    if (_selected == null || quantity == null || quantity <= 0) {
      TopNotice.error(context, 'Select an item and enter a valid quantity.');
      return;
    }
    if (_isWaste && quantity > _selected!.available) {
      TopNotice.error(context, 'Wastage cannot exceed available stock.');
      return;
    }
    final result = await ApiService.recordBaristaInventoryMovement(
      itemId: _selected!.id,
      quantity: quantity,
      isWaste: _isWaste,
      reasonCode: _isWaste ? _reason : null,
      note: _note.text,
    );
    if (!mounted) return;
    if (!result.isSuccess) {
      TopNotice.error(context, result.errorMessage!);
      return;
    }
    _quantity.clear();
    _note.clear();
    TopNotice.info(context, _isWaste ? 'Wastage recorded.' : 'Stock added.');
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _inventory?.items ?? const <BaristaInventoryItem>[];
    return Scaffold(
      backgroundColor: Colors.white,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Inventory',
                      style: Theme.of(context).textTheme.headlineMedium
                          ?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF203E32),
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _inventory?.storeName ?? 'Current outlet',
                      style: const TextStyle(color: Colors.black54),
                    ),
                    const SizedBox(height: 18),
                    _buildMovementCard(items),
                    const SizedBox(height: 18),
                    Text(
                      'Current stock',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (_loading)
                      const Padding(
                        padding: EdgeInsets.all(32),
                        child: Center(child: CircularProgressIndicator()),
                      )
                    else if (items.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'No active inventory items are configured.',
                        ),
                      )
                    else
                      ...items.map(
                        (item) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFF203E32),
                            child: Icon(
                              Icons.inventory_2_outlined,
                              color: Colors.white,
                            ),
                          ),
                          title: Text(
                            item.name,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(item.category),
                          trailing: Text(
                            '${item.onHand.toStringAsFixed(3)} ${item.unitLabel}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
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
    );
  }

  Widget _buildMovementCard(List<BaristaInventoryItem> items) {
    return Card(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: Color(0xFFE2DDD3)),
      ),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  label: Text('Add stock'),
                  icon: Icon(Icons.add_box_outlined),
                ),
                ButtonSegment(
                  value: true,
                  label: Text('Wastage'),
                  icon: Icon(Icons.delete_outline),
                ),
              ],
              selected: {_isWaste},
              style: ButtonStyle(
                backgroundColor: WidgetStateProperty.resolveWith<Color?>((
                  states,
                ) {
                  if (!states.contains(WidgetState.selected)) {
                    return Colors.transparent;
                  }
                  return _isWaste
                      ? const Color(0xFF9A4D43)
                      : const Color(0xFF203E32);
                }),
                foregroundColor: WidgetStateProperty.resolveWith<Color?>((
                  states,
                ) {
                  return states.contains(WidgetState.selected)
                      ? Colors.white
                      : const Color(0xFF4E514D);
                }),
                side: WidgetStateProperty.all(
                  const BorderSide(color: Color(0xFFBEB9B0)),
                ),
              ),
              onSelectionChanged: (value) =>
                  setState(() => _isWaste = value.first),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<BaristaInventoryItem>(
              initialValue: _selected,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Inventory item',
                border: OutlineInputBorder(),
              ),
              items: items
                  .map(
                    (item) => DropdownMenuItem(
                      value: item,
                      child: Text(
                        '${item.name}  (${item.available.toStringAsFixed(3)} ${item.unitLabel} available)',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _selected = value),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _quantity,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(
                labelText: 'Quantity (${_selected?.unitLabel ?? 'unit'})',
                border: const OutlineInputBorder(),
              ),
            ),
            if (_isWaste) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _reason,
                decoration: const InputDecoration(
                  labelText: 'Wastage reason',
                  border: OutlineInputBorder(),
                ),
                items: const [
                  DropdownMenuItem(value: 'expired', child: Text('Expired')),
                  DropdownMenuItem(value: 'damaged', child: Text('Damaged')),
                  DropdownMenuItem(value: 'spillage', child: Text('Spillage')),
                  DropdownMenuItem(
                    value: 'quality',
                    child: Text('Quality issue'),
                  ),
                  DropdownMenuItem(
                    value: 'staff_use',
                    child: Text('Staff use'),
                  ),
                  DropdownMenuItem(value: 'other', child: Text('Other')),
                ],
                onChanged: (value) =>
                    setState(() => _reason = value ?? 'other'),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _note,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Note (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _loading ? null : _submit,
              icon: Icon(_isWaste ? Icons.delete_outline : Icons.add),
              label: Text(_isWaste ? 'Record wastage' : 'Add stock'),
            ),
          ],
        ),
      ),
    );
  }
}
