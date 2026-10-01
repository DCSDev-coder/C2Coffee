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

  // Library options mapping
  final Map<int, List<int>> _librarySelections = {};

  @override
  void initState() {
    super.initState();
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
    if (widget.item.source['desc'] != null && widget.item.source['desc'].toString().isNotEmpty) {
      return widget.item.source['desc'].toString();
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

  Widget _buildSectionTitle(String title, {bool required = true, String subtitle = ''}) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              if (required) ...[
                const SizedBox(width: 4),
                const Text('*', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              ],
            ],
          ),
          if (subtitle.isNotEmpty)
            Text(
              subtitle,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 11,
                color: Colors.black54,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildOptionCard({
    required String title,
    required String subtitle,
    required String value,
    required String groupValue,
    required Function(String) onChanged,
    required Color color,
    required Color textColor,
    bool isGradient = false,
    List<Color>? gradientColors,
  }) {
    bool isSelected = value == groupValue;

    Widget cardChild = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      width: 100,
      height: 100,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      decoration: BoxDecoration(
        color: isSelected ? (isGradient ? null : color) : Colors.white,
        gradient: (isSelected && isGradient && gradientColors != null)
            ? LinearGradient(
                colors: gradientColors,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              )
            : null,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected
              ? (isGradient ? gradientColors!.first : color)
              : Colors.grey.shade300,
          width: 1.5,
        ),
        boxShadow: [
          if (isSelected)
            BoxShadow(
                color: (isGradient ? gradientColors!.first : color).withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 3))
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (title.isNotEmpty)
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 13,
                fontWeight: FontWeight.w900,
                color: isSelected ? textColor : Colors.grey.shade600,
                height: 1.1,
              ),
            ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: isSelected ? textColor.withValues(alpha: 0.9) : Colors.grey.shade400,
              ),
            ),
          ]
        ],
      ),
    );

    return GestureDetector(
      onTap: () => onChanged(value),
      child: cardChild,
    );
  }

  Widget _buildLibraryGroup(CounterModifierGroup group) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(group.name, required: group.minSelect > 0),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: group.options.map((option) {
            final isSelected = _librarySelections[group.id]?.contains(option.id) ?? false;
            final subtitle = option.priceDeltaRm == '0.00' ? '+ 0.00' : '+ \${option.priceDeltaRm}';
            
            return GestureDetector(
              onTap: () {
                setState(() {
                  if (group.selectionType == 'single') {
                    _librarySelections[group.id] = [option.id];
                  } else {
                    final current = List<int>.from(_librarySelections[group.id] ?? []);
                    if (isSelected) {
                      current.remove(option.id);
                    } else if (current.length < group.maxSelect) {
                      current.add(option.id);
                    }
                    _librarySelections[group.id] = current;
                  }
                });
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 100,
                height: 100,
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isSelected ? AppColors.primary : Colors.grey.shade300,
                    width: 1.5,
                  ),
                  boxShadow: [
                    if (isSelected)
                      BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 6,
                          offset: const Offset(0, 3))
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      option.name.toUpperCase(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: isSelected ? Colors.white : Colors.grey.shade600,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.white.withValues(alpha: 0.9) : Colors.grey.shade400,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFEFEBE3), // Beige background!
      appBar: AppBar(
        backgroundColor: const Color(0xFFEFEBE3),
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
              padding: const EdgeInsets.all(16),
              height: 200, // Smaller image
              child: Center(
                child: widget.item.imageUrl != null
                    ? Image.network(
                        widget.item.imageUrl!,
                        fit: BoxFit.contain,
                      )
                    : const Icon(Icons.coffee, size: 80, color: AppColors.secondary),
              ),
            ),
            Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(24),
                  topRight: Radius.circular(24),
                ),
              ),
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

                  if (widget.item.allowChoiceOfBeans) ...[
                    _buildSectionTitle('Choice of Beans'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _buildOptionCard(
                          title: 'DATO\nBLEND',
                          subtitle: '+ 0.00',
                          value: 'Dato Blend',
                          groupValue: _bean,
                          onChanged: (v) => setState(() => _bean = v),
                          color: const Color(0xFF993300),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'DATIN\nBLEND',
                          subtitle: '+ 0.00',
                          value: 'Datin Blend',
                          groupValue: _bean,
                          onChanged: (v) => setState(() => _bean = v),
                          color: Colors.transparent,
                          textColor: Colors.white,
                          isGradient: true,
                          gradientColors: [const Color(0xFFE91E63), const Color(0xFF009624)],
                        ),
                      ],
                    ),
                  ],

                  if (widget.item.allowTemperature) ...[
                    _buildSectionTitle('Choice of Temperature'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _buildOptionCard(
                          title: 'HOT',
                          subtitle: '+ 0.00',
                          value: 'Hot',
                          groupValue: _temperature,
                          onChanged: (v) => setState(() => _temperature = v),
                          color: const Color(0xFFE63900),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'COLD',
                          subtitle: '+ 0.00',
                          value: 'Cold',
                          groupValue: _temperature,
                          onChanged: (v) => setState(() => _temperature = v),
                          color: const Color(0xFF66C2E6),
                          textColor: Colors.white,
                        ),
                      ],
                    ),
                  ],

                  if (widget.item.allowChoiceOfMilk) ...[
                    _buildSectionTitle('Choice of Milk'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _buildOptionCard(
                          title: 'FRESH\nMILK',
                          subtitle: '+ 0.00',
                          value: 'Fresh Milk',
                          groupValue: _milk,
                          onChanged: (v) => setState(() => _milk = v),
                          color: const Color(0xFF007AEC),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'OAT\nMILK',
                          subtitle: 'OATSIDE\n+ 3.00',
                          value: 'Oat Milk',
                          groupValue: _milk,
                          onChanged: (v) => setState(() => _milk = v),
                          color: const Color(0xFF995C00),
                          textColor: Colors.white,
                        ),
                      ],
                    ),
                  ],

                  if (widget.item.allowChoiceOfSweetness) ...[
                    _buildSectionTitle('Choice of Sweetness'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _buildOptionCard(
                          title: 'NO\nSUGAR',
                          subtitle: '+ 0.00',
                          value: 'No Sugar',
                          groupValue: _sweetness,
                          onChanged: (v) => setState(() => _sweetness = v),
                          color: const Color(0xFF7BDB5C),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'LESS\nSWEET',
                          subtitle: '+ 0.00',
                          value: 'Less Sweet',
                          groupValue: _sweetness,
                          onChanged: (v) => setState(() => _sweetness = v),
                          color: const Color(0xFFFF7A00),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'REGULAR\nSWEET',
                          subtitle: '+ 0.00',
                          value: 'Regular Sweet',
                          groupValue: _sweetness,
                          onChanged: (v) => setState(() => _sweetness = v),
                          color: const Color(0xFFD4A017),
                          textColor: Colors.white,
                        ),
                      ],
                    ),
                  ],

                  if (widget.item.allowIceLevel) ...[
                    _buildSectionTitle('Ice Level'),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        _buildOptionCard(
                          title: 'LESS\nICE',
                          subtitle: '+ 0.00',
                          value: 'Less Ice',
                          groupValue: _iceLevel,
                          onChanged: (v) => setState(() => _iceLevel = v),
                          color: const Color(0xFF673AB7),
                          textColor: Colors.white,
                        ),
                        _buildOptionCard(
                          title: 'REGULAR\nICE',
                          subtitle: '+ 0.00',
                          value: 'Regular Ice',
                          groupValue: _iceLevel,
                          onChanged: (v) => setState(() => _iceLevel = v),
                          color: const Color(0xFFD87C8E),
                          textColor: Colors.white,
                        ),
                      ],
                    ),
                  ],

                  // Dynamic Library options mapping
                  for (final group in widget.item.modifierGroups)
                    if (group.name.toLowerCase() != 'order type')
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
              color: Colors.black.withValues(alpha: 0.05),
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
                    'RM ${totalPrice.toStringAsFixed(2)}',
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
