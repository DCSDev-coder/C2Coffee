import 'dart:io';

void main() {
  final content = '''
import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'counter_menu.dart';

class ProductDetailModal extends StatefulWidget {
  final CounterMenuItem item;

  const ProductDetailModal({super.key, required this.item});

  @override
  State<ProductDetailModal> createState() => _ProductDetailModalState();
}

class _ProductDetailModalState extends State<ProductDetailModal> {
  int _quantity = 1;

  // Customization state
  String _bean = 'Dato Blend';
  int _espressoShots = 1;
  String _temperature = 'Cold';
  String _milk = 'Fresh Milk';
  String _sweetness = 'Regular Sweet';
  String _iceLevel = 'Regular Ice';
  String _orderType = 'Take Away';

  // Library options mapping (GroupId -> List of selected Option IDs)
  final Map<int, List<int>> _librarySelections = {};

  @override
  void initState() {
    super.initState();
    // Default selections
    if (widget.item.modifierGroups.isNotEmpty) {
      for (final group in widget.item.modifierGroups) {
        final defaultOptions = group.options.where((o) => o.isDefault).map((o) => o.id).toList();
        if (defaultOptions.isNotEmpty) {
          _librarySelections[group.id] = defaultOptions;
        } else if (group.options.isNotEmpty && group.minSelect > 0) {
          _librarySelections[group.id] = [group.options.first.id];
        } else {
          _librarySelections[group.id] = [];
        }
      }
    }
  }

  String get _itemName => widget.item.name;

  String get _itemDescription {
    if (widget.item.source['desc'] != null &&
        widget.item.source['desc'].toString().isNotEmpty) {
      return widget.item.source['desc'].toString();
    }
    final name = _itemName.toLowerCase();
    if (name.contains('shakerato')) {
      return 'Chilled, shaken espresso with sweet silky and refreshing cream.';
    }
    if (name.contains('mont broga')) {
      return 'Black coffee layered with orangey cold foam and orange zest.';
    }
    if (name.contains('yuzukano')) {
      return 'Aerated espresso topping the chilled yuzu puree.';
    }
    if (name.contains('senja di broga')) {
      return 'Sweet sparkling orange juice topped with espresso.';
    }
    if (name.contains('espresso bomb')) {
      return 'The trendy espresso bomb is here. Choice of sparkling of ginger ade or tonic water.';
    }
    if (name.contains('pinky blush') || name.contains('paddle pop')) {
      return 'Creamy strawberry, delicate banana puree, mix and shaken with milk.';
    }
    if (name.contains('solero fizz')) {
      return 'Bright citrus notes with sparkling soda and creamy, silky cold foam.';
    }
    if (name.contains('cloudy jasmine')) {
      return 'Refreshing jasmine tea soda with silky butterscotch cream foam.';
    }
    if (name.contains('boijito')) {
      return 'Sparkling mojito with hand-picked mint and calamansi flavour.';
    }
    if (name.contains('bloody peach')) {
      return 'Sparkling jasmine tea with peach flavour and top with grenadine syrup.';
    }
    if (name.contains('fuji fizz')) {
      return 'Ginger, apple and cinnamon comes together in a fizzy drinks. Fruity and spice.';
    }
    if (name.contains('spicy mimosa')) {
      return 'Hot and spicy orange juice topped with ginger ade and red berry based of grenadine syrup.';
    }
    if (name.contains('onde2pop')) {
      return 'Green apple and coconut shaken together and topped with sparkling soda .';
    }
    if (name.contains('matcha latte')) {
      return 'Ceremonial grade matcha with smooth, creamy milk.';
    }
    if (name.contains('monkey matcha')) {
      return 'Ceremonial grade matcha with ripe banana puree.';
    }
    if (name.contains('pinky promise matcha')) {
      return 'Ceremonial grade matcha with strawberry puree sweetness.';
    }
    if (name.contains('milk chocolate')) {
      return 'Rich and smooth chocolate milk drinks topped with marshmallows.';
    }
    if (name.contains('nutty chocolate')) {
      return 'Chocolate drink mixed with crunchy peanut butter.';
    }
    if (name.contains('v60')) {
      return 'Hand-poured coffee revealing delicate aroma and clarity.';
    }
    if (name.contains('pocco')) {
      return 'An espresso and oatmilk-small in size, rich in flavour.';
    }
    if (name.contains('butterscotch latte')) {
      return 'Smooth espresso and milk mix with butterscotch flavour.';
    }
    if (name.contains('hazelnut latte')) {
      return 'Espresso and milk mixed with hazelnut flavour.';
    }
    if (name.contains('vanilla latte')) {
      return 'Gentle vanilla sweetness lifting smooth espresso.';
    }
    if (name.contains('flat white')) {
      return 'Espresso top with hot milk with a thin layer of smooth foam.';
    }
    if (name.contains('cappuccino') || name.contains('cappucino')) {
      return 'Espresso topped with light and thick foam and delicate milk.';
    }
    if (name.contains('blue cloud')) {
      return 'Black coffee with coconut flavour topped with creamy light blue cold foam.';
    }
    if (name.contains('mocha')) {
      return 'Chocolate and espresso mixed with milk.';
    }
    if (name.contains('latte')) {
      return 'Espresso top with milk with layered of smooth foam.';
    }
    if (name == 'espresso' || name.contains('espresso')) {
      return 'Pure, concentrated coffee. Choose between bold taste note or lighter note';
    }
    return 'Specialty handcrafted drink prepared fresh to order.';
  }

  double get totalPrice {
    if (widget.item.modifierGroups.isNotEmpty) {
      double adjustment = 0;
      for (final group in widget.item.modifierGroups) {
        final selections = _librarySelections[group.id] ?? [];
        for (final optionId in selections) {
          final option = group.options.firstWhere((o) => o.id == optionId);
          adjustment += double.tryParse(option.priceDeltaRm) ?? 0;
        }
      }
      return (widget.item.priceRm + adjustment) * _quantity;
    }
    double basePrice = widget.item.priceRm;
    if (widget.item.allowEspressoShot) {
      if (_espressoShots == 2) basePrice += 3.00;
      if (_espressoShots == 3) basePrice += 6.00;
    }
    if (widget.item.allowChoiceOfMilk) {
      if (_milk == 'Oat Milk') basePrice += 3.00;
    }
    return basePrice * _quantity;
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 12),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Colors.black54,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildChipSelector({
    required String title,
    required List<String> options,
    required String selected,
    required ValueChanged<String> onSelected,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(title),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options.map((option) {
            final isSelected = option == selected;
            return ChoiceChip(
              label: Text(option),
              selected: isSelected,
              onSelected: (bool selected) {
                if (selected) onSelected(option);
              },
              selectedColor: AppColors.primary,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.black87,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              backgroundColor: Colors.grey[200],
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildLibraryGroup(CounterModifierGroup group) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(group.name),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: group.options.map((option) {
            final isSelected = _librarySelections[group.id]?.contains(option.id) ?? false;
            return ChoiceChip(
              label: Text(option.name),
              selected: isSelected,
              onSelected: (bool selected) {
                setState(() {
                  if (group.selectionType == 'single') {
                    _librarySelections[group.id] = selected ? [option.id] : [];
                  } else {
                    final current = List<int>.from(_librarySelections[group.id] ?? []);
                    if (selected) {
                      if (current.length < group.maxSelect) {
                        current.add(option.id);
                      }
                    } else {
                      current.remove(option.id);
                    }
                    _librarySelections[group.id] = current;
                  }
                });
              },
              selectedColor: AppColors.primary,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : Colors.black87,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              backgroundColor: Colors.grey[200],
            );
          }).toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(widget.item.name),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Image header
            Container(
              color: AppColors.surfaceLight,
              padding: const EdgeInsets.all(32),
              height: 250,
              child: Center(
                child: widget.item.imageUrl != null
                    ? Image.network(
                        widget.item.imageUrl!,
                        fit: BoxFit.contain,
                      )
                    : const Icon(Icons.coffee, size: 80, color: AppColors.secondary),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.item.name,
                    style: const TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _itemDescription,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Divider(),

                  // Hardcoded boolean options mapping (similar to mobile app)
                  if (widget.item.allowChoiceOfBeans)
                    _buildChipSelector(
                      title: 'Choice of Bean',
                      options: ['Dato Blend', 'Datin Blend'],
                      selected: _bean,
                      onSelected: (val) => setState(() => _bean = val),
                    ),

                  if (widget.item.allowTemperature)
                    _buildChipSelector(
                      title: 'Temperature',
                      options: ['Hot', 'Cold'],
                      selected: _temperature,
                      onSelected: (val) => setState(() => _temperature = val),
                    ),

                  if (widget.item.allowChoiceOfMilk)
                    _buildChipSelector(
                      title: 'Choice of Milk',
                      options: ['Fresh Milk', 'Oat Milk', 'Soy Milk'],
                      selected: _milk,
                      onSelected: (val) => setState(() => _milk = val),
                    ),

                  if (widget.item.allowChoiceOfSweetness)
                    _buildChipSelector(
                      title: 'Sweetness',
                      options: ['No Sugar', 'Less Sweet', 'Regular Sweet', 'Extra Sweet'],
                      selected: _sweetness,
                      onSelected: (val) => setState(() => _sweetness = val),
                    ),

                  if (widget.item.allowIceLevel)
                    _buildChipSelector(
                      title: 'Ice Level',
                      options: ['No Ice', 'Less Ice', 'Regular Ice', 'Extra Ice'],
                      selected: _iceLevel,
                      onSelected: (val) => setState(() => _iceLevel = val),
                    ),

                  // Dynamic Library options mapping
                  for (final group in widget.item.modifierGroups)
                    _buildLibraryGroup(group),

                  const SizedBox(height: 80), // padding for bottom bar
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Total',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87),
                  ),
                  Text(
                    'RM \${totalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.primary),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            if (_quantity > 1) setState(() => _quantity--);
                          },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10.0),
                          child: Text(
                            _quantity.toString(),
                            style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 16,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            setState(() => _quantity++);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        final customization = {
                          'quantity': _quantity,
                          'bean': widget.item.allowChoiceOfBeans ? _bean : null,
                          'temperature': widget.item.allowTemperature ? _temperature : null,
                          'milk': widget.item.allowChoiceOfMilk ? _milk : null,
                          'sweetness': widget.item.allowChoiceOfSweetness ? _sweetness : null,
                          'iceLevel': widget.item.allowIceLevel ? _iceLevel : null,
                          'librarySelections': _librarySelections,
                        };
                        Navigator.of(context).pop(customization);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: const Text(
                        'ADD TO CART',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
''';
  File(r'c:\C2\counter_app\lib\product_detail_modal.dart').writeAsStringSync(content);
}
