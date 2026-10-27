import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'counter_cart_modifiers.dart';
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
  final int _espressoShots = 1;
  String _temperature = 'Cold';
  String _milk = 'Fresh Milk';
  String _sweetness = 'Regular Sweet';
  String _iceLevel = 'Regular Ice';

  // Library options mapping
  final Map<int, List<int>> _librarySelections = {};
  final Set<int> _missingRequiredGroups = {};

  bool _hasLibraryGroup(String keyword) =>
      counterHasLibraryGroup(widget.item, keyword);

  @override
  void initState() {
    super.initState();
    if (widget.item.modifierGroups.isNotEmpty) {
      for (final group in widget.item.modifierGroups) {
        final defaultOptions = group.options
            .where((o) => o.isDefault)
            .map((o) => o.id)
            .toList();
        if (defaultOptions.isNotEmpty) {
          _librarySelections[group.id] = defaultOptions;
        } else {
          _librarySelections[group.id] = [];
        }
      }
    }
  }

  String get _itemDescription {
    if (widget.item.source['desc'] != null &&
        widget.item.source['desc'].toString().isNotEmpty) {
      return widget.item.source['desc'].toString();
    }
    return 'Specialty handcrafted drink prepared fresh to order.';
  }

  double get totalPrice {
    final modifiers = buildCounterCartModifiers(
      item: widget.item,
      customization: _customization(),
    );
    return (widget.item.priceRm + counterCartModifierTotal(modifiers)) *
        _quantity;
  }

  Map<String, dynamic> _customization() => {
    'quantity': _quantity,
    'bean': widget.item.allowChoiceOfBeans && !_hasLibraryGroup('bean')
        ? _bean
        : null,
    'espressoShots':
        widget.item.allowEspressoShot && !_hasLibraryGroup('espresso')
        ? '$_espressoShots shot${_espressoShots == 1 ? '' : 's'}'
        : null,
    'temperature':
        widget.item.allowTemperature && !_hasLibraryGroup('temperature')
        ? _temperature
        : null,
    'milk': widget.item.allowChoiceOfMilk && !_hasLibraryGroup('milk')
        ? _milk
        : null,
    'sweetness':
        widget.item.allowChoiceOfSweetness && !_hasLibraryGroup('sweet')
        ? _sweetness
        : null,
    'iceLevel':
        widget.item.allowIceLevel &&
            !_hasLibraryGroup('ice') &&
            _temperature == 'Cold'
        ? _iceLevel
        : null,
    'librarySelections': _librarySelections,
  };

  void _onAddToCart() {
    final missing = <int>{};
    for (final group in widget.item.modifierGroups) {
      if (group.name.toLowerCase() == 'order type') {
        continue;
      }
      final minimum = group.isRequired
          ? math.max(1, group.minSelect)
          : group.minSelect;
      if (minimum > 0 &&
          (_librarySelections[group.id] ?? const []).length < minimum) {
        missing.add(group.id);
      }
    }
    if (missing.isNotEmpty) {
      setState(() {
        _missingRequiredGroups
          ..clear()
          ..addAll(missing);
      });
      return;
    }
    Navigator.of(context).pop(_customization());
  }

  Widget _buildSectionTitle(String title, {bool required = true}) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(
                title.toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.6,
                  color: AppColors.charcoal,
                ),
              ),
              if (required) ...[
                const SizedBox(width: 4),
                const Text(
                  '*',
                  style: TextStyle(
                    color: Colors.red,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ],
          ),
          if (required)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.red.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Required',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.red,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildResponsiveGrid({
    required List<Widget> children,
    double spacing = 12,
    double runSpacing = 12,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final count = children.length;
        int columns;
        if (count == 1) {
          columns = 1;
        } else if (count == 2) {
          columns = 2;
        } else if (count == 3) {
          columns = width >= 520 ? 3 : 2;
        } else if (count == 4) {
          columns = width >= 660 ? 4 : 2;
        } else {
          columns = width >= 720 ? 3 : 2;
        }

        final itemWidth = (width - (spacing * (columns - 1))) / columns;

        return Wrap(
          spacing: spacing,
          runSpacing: runSpacing,
          children: children.map((child) {
            return SizedBox(width: itemWidth, child: child);
          }).toList(),
        );
      },
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
    final bool isSelected = value == groupValue;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => onChanged(value),
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 76),
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
          decoration: BoxDecoration(
            color: isSelected ? (isGradient ? null : color) : Colors.white,
            gradient: (isSelected && isGradient && gradientColors != null)
                ? LinearGradient(
                    colors: gradientColors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  )
                : null,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected
                  ? (isGradient ? gradientColors!.first : color)
                  : Colors.grey.shade300,
              width: isSelected ? 2.0 : 1.5,
            ),
            boxShadow: [
              if (isSelected)
                BoxShadow(
                  color: (isGradient ? gradientColors!.first : color)
                      .withValues(alpha: 0.28),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title.replaceAll('\n', ' '),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        color: isSelected ? textColor : const Color(0xFF222B2E),
                        height: 1.15,
                      ),
                    ),
                    if (subtitle.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        subtitle.replaceAll('\n', ' • '),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: isSelected
                              ? textColor.withValues(alpha: 0.9)
                              : Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (isSelected) ...[
                const SizedBox(width: 8),
                Icon(Icons.check_circle_rounded, size: 20, color: textColor),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLibraryGroup(CounterModifierGroup group) {
    final isMissing = _missingRequiredGroups.contains(group.id);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionTitle(
          group.name,
          required: group.isRequired || group.minSelect > 0,
        ),
        if (isMissing)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text(
              'Please choose an option before adding this item.',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
            ),
          ),
        _buildResponsiveGrid(
          children: group.options.map((option) {
            final isSelected =
                _librarySelections[group.id]?.contains(option.id) ?? false;
            final subtitle = option.priceDeltaRm == '0.00'
                ? '+ 0.00'
                : '+ RM ${option.priceDeltaRm}';

            return Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  setState(() {
                    if (group.selectionType == 'single') {
                      _librarySelections[group.id] = [option.id];
                    } else {
                      final current = List<int>.from(
                        _librarySelections[group.id] ?? [],
                      );
                      if (isSelected) {
                        current.remove(option.id);
                      } else if (current.length < group.maxSelect) {
                        current.add(option.id);
                      }
                      _librarySelections[group.id] = current;
                    }
                  });
                },
                borderRadius: BorderRadius.circular(16),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  constraints: const BoxConstraints(minHeight: 76),
                  padding: const EdgeInsets.symmetric(
                    vertical: 12,
                    horizontal: 16,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isSelected
                          ? AppColors.primary
                          : isMissing
                          ? Colors.red
                          : Colors.grey.shade300,
                      width: isSelected ? 2.0 : 1.5,
                    ),
                    boxShadow: [
                      if (isSelected)
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.25),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.center,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              option.name.toUpperCase(),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: isSelected
                                    ? Colors.white
                                    : const Color(0xFF222B2E),
                                height: 1.15,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              subtitle,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? Colors.white.withValues(alpha: 0.9)
                                    : Colors.grey.shade600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isSelected) ...[
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.check_circle_rounded,
                          size: 20,
                          color: Colors.white,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  List<Widget> _buildCustomizationGroups() {
    return [
      if (widget.item.allowChoiceOfBeans && !_hasLibraryGroup('bean')) ...[
        _buildSectionTitle('Choice of Beans'),
        _buildResponsiveGrid(
          children: [
            _buildOptionCard(
              title: 'Dato Blend',
              subtitle: '+ 0.00',
              value: 'Dato Blend',
              groupValue: _bean,
              onChanged: (v) => setState(() => _bean = v),
              color: const Color(0xFF993300),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Datin Blend',
              subtitle: '+ 0.00',
              value: 'Datin Blend',
              groupValue: _bean,
              onChanged: (v) => setState(() => _bean = v),
              color: Colors.transparent,
              textColor: Colors.white,
              isGradient: true,
              gradientColors: [
                const Color(0xFFE91E63),
                const Color(0xFF009624),
              ],
            ),
          ],
        ),
      ],

      if (widget.item.allowTemperature && !_hasLibraryGroup('temperature')) ...[
        _buildSectionTitle('Choice of Temperature'),
        _buildResponsiveGrid(
          children: [
            _buildOptionCard(
              title: 'Hot',
              subtitle: '+ 0.00',
              value: 'Hot',
              groupValue: _temperature,
              onChanged: (v) => setState(() => _temperature = v),
              color: const Color(0xFFE63900),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Cold',
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

      if (widget.item.allowChoiceOfMilk && !_hasLibraryGroup('milk')) ...[
        _buildSectionTitle('Choice of Milk'),
        _buildResponsiveGrid(
          children: [
            _buildOptionCard(
              title: 'Fresh Milk',
              subtitle: '+ 0.00',
              value: 'Fresh Milk',
              groupValue: _milk,
              onChanged: (v) => setState(() => _milk = v),
              color: const Color(0xFF007AEC),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Oat Milk',
              subtitle: 'Oatside • + RM 3.00',
              value: 'Oat Milk',
              groupValue: _milk,
              onChanged: (v) => setState(() => _milk = v),
              color: const Color(0xFF995C00),
              textColor: Colors.white,
            ),
          ],
        ),
      ],

      if (widget.item.allowChoiceOfSweetness && !_hasLibraryGroup('sweet')) ...[
        _buildSectionTitle('Choice of Sweetness'),
        _buildResponsiveGrid(
          children: [
            _buildOptionCard(
              title: 'No Sugar',
              subtitle: '+ 0.00',
              value: 'No Sugar',
              groupValue: _sweetness,
              onChanged: (v) => setState(() => _sweetness = v),
              color: const Color(0xFF7BDB5C),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Less Sweet',
              subtitle: '+ 0.00',
              value: 'Less Sweet',
              groupValue: _sweetness,
              onChanged: (v) => setState(() => _sweetness = v),
              color: const Color(0xFFFF7A00),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Regular Sweet',
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

      if (widget.item.allowIceLevel &&
          !_hasLibraryGroup('ice') &&
          _temperature == 'Cold') ...[
        _buildSectionTitle('Ice Level'),
        _buildResponsiveGrid(
          children: [
            _buildOptionCard(
              title: 'Less Ice',
              subtitle: '+ 0.00',
              value: 'Less Ice',
              groupValue: _iceLevel,
              onChanged: (v) => setState(() => _iceLevel = v),
              color: const Color(0xFF673AB7),
              textColor: Colors.white,
            ),
            _buildOptionCard(
              title: 'Regular Ice',
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
        if (group.name.toLowerCase() != 'order type') _buildLibraryGroup(group),
    ];
  }

  Widget _buildQuantityAndCartBar({bool isCompact = false}) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: isCompact ? 16 : 24,
        vertical: 14,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Total',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black54,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'RM ${totalPrice.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 20),
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFFF4F6F5),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.remove, size: 20),
                    constraints: const BoxConstraints(
                      minWidth: 42,
                      minHeight: 42,
                    ),
                    color: AppColors.primary,
                    onPressed: () {
                      if (_quantity > 1) setState(() => _quantity--);
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12.0),
                    child: Text(
                      _quantity.toString(),
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.charcoal,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.add, size: 20),
                    constraints: const BoxConstraints(
                      minWidth: 42,
                      minHeight: 42,
                    ),
                    color: AppColors.primary,
                    onPressed: () {
                      setState(() => _quantity++);
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _onAddToCart,
                icon: const Icon(
                  Icons.shopping_bag_outlined,
                  color: Colors.white,
                  size: 20,
                ),
                label: const Text(
                  'ADD TO CART',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: Colors.white,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProductHeroInfo({bool isLandscape = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          height: isLandscape ? 260 : 200,
          decoration: BoxDecoration(
            color: const Color(0xFFF7F5F0),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Center(
            child: widget.item.imageUrl != null
                ? Image.network(
                    widget.item.imageUrl!,
                    fit: BoxFit.contain,
                    height: isLandscape ? 220 : 170,
                  )
                : const Icon(
                    Icons.coffee,
                    size: 90,
                    color: AppColors.secondary,
                  ),
          ),
        ),
        const SizedBox(height: 18),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                widget.item.name,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: isLandscape ? 30 : 26,
                  fontWeight: FontWeight.bold,
                  color: AppColors.charcoal,
                  height: 1.1,
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'RM ${widget.item.priceRm.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          _itemDescription,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 16,
            color: Colors.black54,
            height: 1.35,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F5F0),
      appBar: AppBar(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.charcoal,
        elevation: 0,
        scrolledUnderElevation: 1,
        title: Text(
          widget.item.name,
          style: const TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.charcoal,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 26),
            tooltip: 'Return',
            onPressed: () => Navigator.of(context).pop(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final isLandscape = constraints.maxWidth >= 860;

          if (isLandscape) {
            // Tablet Horizontal (Landscape) - Dual Pane Layout
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Left pane: Product Overview (Hero)
                SizedBox(
                  width: math.min(constraints.maxWidth * 0.42, 440),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(28.0),
                    child: Container(
                      padding: const EdgeInsets.all(24.0),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.08),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.04),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: _buildProductHeroInfo(isLandscape: true),
                    ),
                  ),
                ),
                // Right pane: Scrollable Customization Options with Pinned Cart Bar
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.fromLTRB(0, 20, 24, 20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.08),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 14,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          padding: const EdgeInsets.fromLTRB(28, 20, 28, 16),
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: Colors.grey.shade200),
                            ),
                          ),
                          child: const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Customize Your Order',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.primary,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Select your preferred options below',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 15,
                                  color: Colors.black54,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: SingleChildScrollView(
                            padding: const EdgeInsets.fromLTRB(28, 12, 28, 28),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: _buildCustomizationGroups(),
                            ),
                          ),
                        ),
                        _buildQuantityAndCartBar(isCompact: false),
                      ],
                    ),
                  ),
                ),
              ],
            );
          }

          // Tablet Vertical (Portrait) - Centered Single Column Layout
          return Column(
            children: [
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20.0),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: _buildProductHeroInfo(isLandscape: false),
                          ),
                          const SizedBox(height: 16),
                          Container(
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.04),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: _buildCustomizationGroups(),
                            ),
                          ),
                          const SizedBox(height: 20),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              _buildQuantityAndCartBar(isCompact: false),
            ],
          );
        },
      ),
    );
  }
}
