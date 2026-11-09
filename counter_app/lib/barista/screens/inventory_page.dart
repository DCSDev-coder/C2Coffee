import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../../widgets/top_notice.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';

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
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String? _selectedCategory;
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
    _searchController.dispose();
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

  BaristaInventoryItem? _findItem(
    List<BaristaInventoryItem> items,
    BaristaInventoryItem? selected,
  ) {
    if (selected == null) return null;
    for (final item in items) {
      if (item.id == selected.id) return item;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final items = _inventory?.items ?? const <BaristaInventoryItem>[];
    final categories = items
        .map((e) => e.category.trim())
        .where((c) => c.isNotEmpty)
        .toSet()
        .toList()
      ..sort();

    final filteredItems = items.where((item) {
      if (_selectedCategory != null && item.category.trim() != _selectedCategory) {
        return false;
      }
      if (_searchQuery.isEmpty) return true;
      final query = _searchQuery.toLowerCase();
      return item.name.toLowerCase().contains(query) ||
          item.category.toLowerCase().contains(query) ||
          item.unitLabel.toLowerCase().contains(query);
    }).toList();

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
                    BaristaPageHeader(
                      title: 'Inventory',
                      subtitle:
                          'Track outlet stock levels, record movements, and report wastage.',
                      onRefresh: _load,
                      refreshTooltip: 'Refresh inventory',
                      bottom: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
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
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.storefront_outlined,
                                size: 14,
                                color: Color(0xFF203E32),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                _inventory?.storeName ?? 'Current outlet',
                                style: const TextStyle(
                                  color: Color(0xFF203E32),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 22),
                    const BaristaSectionLabel(label: 'STOCK MOVEMENT'),
                    const SizedBox(height: 12),
                    _buildMovementCard(items),
                    const SizedBox(height: 26),

                    // Section 2: Current Stock with Search & Filtering
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const BaristaSectionLabel(label: 'CURRENT STOCK'),
                        if (!_loading)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 9,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFF203E32).withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${filteredItems.length} / ${items.length} items',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                color: Color(0xFF203E32),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildFilterBar(categories),
                    const SizedBox(height: 14),

                    BaristaCard(
                      child: _loading
                          ? const Padding(
                              padding: EdgeInsets.all(32),
                              child: Center(
                                child: CircularProgressIndicator(
                                  color: Color(0xFF203E32),
                                ),
                              ),
                            )
                          : items.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 24,
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.inventory_2_outlined,
                                      size: 44,
                                      color: const Color(
                                        0xFF203E32,
                                      ).withValues(alpha: 0.25),
                                    ),
                                    const SizedBox(height: 12),
                                    const Text(
                                      'No active inventory items are configured.',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        color: Color(0xFF203E32),
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : filteredItems.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 36,
                                ),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.search_off_rounded,
                                      size: 40,
                                      color: const Color(
                                        0xFF203E32,
                                      ).withValues(alpha: 0.3),
                                    ),
                                    const SizedBox(height: 10),
                                    Text(
                                      'No items match "$_searchQuery"',
                                      style: const TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF203E32),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : ListView.separated(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: filteredItems.length,
                              separatorBuilder: (context, index) => Divider(
                                height: 1,
                                color: const Color(
                                  0xFF203E32,
                                ).withValues(alpha: 0.08),
                              ),
                              itemBuilder: (context, index) {
                                final item = filteredItems[index];
                                final isSelected = _selected?.id == item.id;
                                return ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 16,
                                    vertical: 6,
                                  ),
                                  tileColor: isSelected
                                      ? const Color(0xFF203E32).withValues(alpha: 0.05)
                                      : null,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  leading: const CircleAvatar(
                                    backgroundColor: Color(0xFF203E32),
                                    child: Icon(
                                      Icons.inventory_2_outlined,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                  ),
                                  title: Text(
                                    item.name,
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF203E32),
                                    ),
                                  ),
                                  subtitle: Text(
                                    item.category,
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 13,
                                      color: const Color(0xFF203E32).withValues(alpha: 0.6),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                  trailing: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Text(
                                            '${item.onHand.toStringAsFixed(3)} ${item.unitLabel}',
                                            style: const TextStyle(
                                              fontFamily: 'Afacad',
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800,
                                              color: Color(0xFF203E32),
                                            ),
                                          ),
                                          Text(
                                            '${item.available.toStringAsFixed(3)} available',
                                            style: TextStyle(
                                              fontFamily: 'Afacad',
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w600,
                                              color: const Color(0xFF203E32).withValues(alpha: 0.5),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(width: 8),
                                      IconButton(
                                        tooltip: 'Select for stock movement',
                                        icon: Icon(
                                          isSelected
                                              ? Icons.check_circle_rounded
                                              : Icons.add_circle_outline_rounded,
                                          color: isSelected
                                              ? const Color(0xFF203E32)
                                              : const Color(0xFF203E32).withValues(alpha: 0.4),
                                          size: 22,
                                        ),
                                        onPressed: () {
                                          setState(() => _selected = item);
                                          TopNotice.info(
                                            context,
                                            'Selected "${item.name}" for stock movement.',
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                  onTap: () {
                                    setState(() => _selected = item);
                                    TopNotice.info(
                                      context,
                                      'Selected "${item.name}" for stock movement.',
                                    );
                                  },
                                );
                              },
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

  Widget _buildFilterBar(List<String> categories) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _searchController,
          onChanged: (val) => setState(() => _searchQuery = val.trim()),
          decoration: InputDecoration(
            hintText: 'Search inventory items or categories...',
            hintStyle: TextStyle(
              fontFamily: 'Afacad',
              color: const Color(0xFF203E32).withValues(alpha: 0.45),
              fontSize: 14,
            ),
            prefixIcon: const Icon(
              Icons.search_rounded,
              color: Color(0xFF203E32),
              size: 20,
            ),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    },
                  )
                : null,
            filled: true,
            fillColor: const Color(0xFF203E32).withValues(alpha: 0.03),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: const Color(0xFF203E32).withValues(alpha: 0.12),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: const Color(0xFF203E32).withValues(alpha: 0.12),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Color(0xFF203E32),
                width: 1.5,
              ),
            ),
          ),
        ),
        if (categories.length > 1) ...[
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildCategoryChip(
                  label: 'All',
                  isSelected: _selectedCategory == null,
                  onTap: () => setState(() => _selectedCategory = null),
                ),
                for (final cat in categories)
                  _buildCategoryChip(
                    label: cat,
                    isSelected: _selectedCategory == cat,
                    onTap: () => setState(() => _selectedCategory = cat),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildCategoryChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: FilterChip(
        label: Text(label),
        selected: isSelected,
        onSelected: (_) => onTap(),
        selectedColor: const Color(0xFF203E32),
        backgroundColor: Colors.white,
        side: BorderSide(
          color: isSelected
              ? const Color(0xFF203E32)
              : const Color(0xFF203E32).withValues(alpha: 0.16),
        ),
        labelStyle: TextStyle(
          fontFamily: 'Afacad',
          color: isSelected ? Colors.white : const Color(0xFF203E32),
          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
          fontSize: 13,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        showCheckmark: false,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      ),
    );
  }

  Widget _buildMovementCard(List<BaristaInventoryItem> items) {
    final matchedSelected = _findItem(items, _selected);

    return BaristaCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(
                value: false,
                label: Text('Add Inventory'),
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
            key: ValueKey(matchedSelected?.id),
            initialValue: matchedSelected,
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
            style: FilledButton.styleFrom(
              backgroundColor: _isWaste
                  ? const Color(0xFF9A4D43)
                  : const Color(0xFF203E32),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            onPressed: _loading ? null : _submit,
            icon: Icon(_isWaste ? Icons.delete_outline : Icons.add),
            label: Text(_isWaste ? 'Record wastage' : 'Add stock'),
          ),
        ],
      ),
    );
  }
}
