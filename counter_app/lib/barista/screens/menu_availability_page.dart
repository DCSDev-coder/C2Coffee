import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../../widgets/top_notice.dart';
import '../widgets/barista_page_header.dart';
import '../widgets/barista_card.dart';

class MenuAvailabilityPage extends StatefulWidget {
  const MenuAvailabilityPage({super.key});

  @override
  State<MenuAvailabilityPage> createState() => _MenuAvailabilityPageState();
}

class _MenuAvailabilityPageState extends State<MenuAvailabilityPage> {
  BaristaMenuAvailabilityResult? _data;
  bool _loading = true;
  String _searchQuery = '';
  int? _selectedCategoryId;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final value = await ApiService.fetchMenuAvailability();
      if (mounted) {
        setState(() {
          _data = value;
          _loading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _loading = false);
        TopNotice.error(
          context,
          error.toString().replaceFirst('Bad state: ', '').replaceFirst('Exception: ', ''),
        );
      }
    }
  }

  Future<void> _toggleCustomization({
    required String type,
    required BaristaCustomizationOption option,
    required bool newValue,
  }) async {
    final previous = option.isAvailable;
    setState(() {
      option.isAvailable = newValue;
    });

    final result = await ApiService.updateCustomizationAvailability(
      type: type,
      value: option.value,
      isAvailable: newValue,
    );

    if (!mounted) return;
    if (!result.isSuccess) {
      setState(() {
        option.isAvailable = previous;
      });
      TopNotice.error(
        context,
        result.errorMessage ?? 'Failed to update ${option.name} availability.',
      );
    } else {
      TopNotice.info(
        context,
        newValue
            ? '${option.name} is now available for customer orders.'
            : '${option.name} marked out of stock. Customer choices adapt automatically.',
      );
    }
  }

  Future<void> _toggleBean(BaristaBeanBlend bean, bool newValue) async {
    final option = BaristaCustomizationOption(
      code: bean.code,
      name: bean.name,
      subtitle: bean.subtitle,
      value: bean.value,
      isAvailable: bean.isAvailable,
    );
    await _toggleCustomization(
      type: 'bean',
      option: option,
      newValue: newValue,
    );
    if (mounted) {
      setState(() {
        bean.isAvailable = option.isAvailable;
      });
    }
  }

  Future<void> _toggleItem(BaristaMenuItemAvailability item, bool newValue) async {
    final previous = item.isAvailable;
    setState(() {
      item.isAvailable = newValue;
    });

    final result = await ApiService.updateMenuItemAvailability(
      itemId: item.id,
      isAvailable: newValue,
    );

    if (!mounted) return;
    if (!result.isSuccess) {
      setState(() {
        item.isAvailable = previous;
      });
      TopNotice.error(context, result.errorMessage ?? 'Failed to update item availability.');
    } else {
      TopNotice.info(
        context,
        newValue
            ? '${item.name} is now available for ordering.'
            : '${item.name} marked as sold out.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = _data?.categories ?? const <BaristaMenuCategory>[];
    final beans = _data?.beans ?? const <BaristaBeanBlend>[];
    final customizations = _data?.customizations ?? const <BaristaCustomizationGroup>[];

    // Filter items
    final allItems = <({BaristaMenuCategory category, BaristaMenuItemAvailability item})>[];
    for (final cat in categories) {
      if (_selectedCategoryId != null && cat.id != _selectedCategoryId) continue;
      for (final item in cat.items) {
        if (_searchQuery.isNotEmpty) {
          final q = _searchQuery.toLowerCase();
          final matchesName = item.name.toLowerCase().contains(q);
          final matchesCat = cat.name.toLowerCase().contains(q);
          if (!matchesName && !matchesCat) continue;
        }
        allItems.add((category: cat, item: item));
      }
    }

    final totalCount = categories.fold<int>(0, (sum, cat) => sum + cat.items.length);
    final availableCount = categories.fold<int>(
      0,
      (sum, cat) => sum + cat.items.where((i) => i.isAvailable).length,
    );

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
                      title: 'Menu Availability',
                      subtitle:
                          'Manage drink and customization availability when stock runs low or out.',
                      onRefresh: _load,
                      refreshTooltip: 'Refresh availability',
                      bottom: Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF203E32).withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: const Color(0xFF203E32).withValues(alpha: 0.12),
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
                                _data?.storeName ?? 'Current outlet',
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

                    // Section 1: Ingredients & Customizations
                    const BaristaSectionLabel(label: 'INGREDIENTS & CUSTOMIZATIONS'),
                    const SizedBox(height: 8),
                    Text(
                      'Manage ingredient options like coffee beans, milk varieties, and mixers. Toggling an option off removes it from customer kiosks in real-time.',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13.5,
                        color: const Color(0xFF203E32).withValues(alpha: 0.65),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _buildCustomizationsSection(customizations, beans),

                    const SizedBox(height: 26),

                    // Section 2: Menu Items & Drinks
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        const BaristaSectionLabel(label: 'DRINKS & MENU ITEMS'),
                        if (!_loading)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF203E32).withValues(alpha: 0.06),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$availableCount / $totalCount available',
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

                    // Search & Category Filters
                    _buildFilterBar(categories),
                    const SizedBox(height: 14),

                    // Items List
                    if (_loading)
                      const BaristaCard(
                        child: Padding(
                          padding: EdgeInsets.all(40),
                          child: Center(
                            child: CircularProgressIndicator(
                              color: Color(0xFF203E32),
                            ),
                          ),
                        ),
                      )
                    else if (allItems.isEmpty)
                      BaristaCard(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 36),
                          child: Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.search_off_rounded,
                                  size: 40,
                                  color: const Color(0xFF203E32).withValues(alpha: 0.3),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  _searchQuery.isNotEmpty
                                      ? 'No items match "$_searchQuery"'
                                      : 'No menu items found.',
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
                        ),
                      )
                    else
                      BaristaCard(
                        child: ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: allItems.length,
                          separatorBuilder: (context, index) => Divider(
                            height: 1,
                            color: const Color(0xFF203E32).withValues(alpha: 0.08),
                          ),
                          itemBuilder: (context, index) {
                            final entry = allItems[index];
                            return _buildMenuItemRow(entry.category, entry.item);
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

  Widget _buildCustomizationsSection(
    List<BaristaCustomizationGroup> groups,
    List<BaristaBeanBlend> fallbackBeans,
  ) {
    if (_loading && groups.isEmpty && fallbackBeans.isEmpty) {
      return const BaristaCard(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: CircularProgressIndicator(color: Color(0xFF203E32)),
          ),
        ),
      );
    }

    if (groups.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (int i = 0; i < groups.length; i++) ...[
            if (i > 0) const SizedBox(height: 16),
            _buildCustomizationGroupCard(groups[i]),
          ],
        ],
      );
    }

    // Fallback to beans if customizations array isn't populated
    return _buildBeanBlendsCard(fallbackBeans);
  }

  Widget _buildCustomizationGroupCard(BaristaCustomizationGroup group) {
    return BaristaCard(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                _buildGroupHeaderIcon(group.type),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        group.categoryName,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF203E32),
                        ),
                      ),
                      if (group.description.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          group.description,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12.5,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF203E32).withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Divider(
              height: 1,
              color: const Color(0xFF203E32).withValues(alpha: 0.08),
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, constraints) {
                final isWide = constraints.maxWidth >= 540;
                final cards = group.options
                    .map((opt) => _buildOptionTile(group.type, opt))
                    .toList();

                if (isWide && cards.length == 2) {
                  return Row(
                    children: [
                      Expanded(child: cards[0]),
                      const SizedBox(width: 12),
                      Expanded(child: cards[1]),
                    ],
                  );
                }

                return Column(
                  children: [
                    for (int i = 0; i < cards.length; i++) ...[
                      if (i > 0) const SizedBox(height: 8),
                      cards[i],
                    ],
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGroupHeaderIcon(String type) {
    IconData icon;
    Color color;

    switch (type) {
      case 'bean':
        icon = Icons.coffee_rounded;
        color = const Color(0xFF993300);
        break;
      case 'milk':
        icon = Icons.water_drop_rounded;
        color = const Color(0xFF1D4ED8);
        break;
      case 'sparkling':
        icon = Icons.bubble_chart_rounded;
        color = const Color(0xFF0D9488);
        break;
      default:
        icon = Icons.tune_rounded;
        color = const Color(0xFF203E32);
    }

    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, color: color, size: 18),
    );
  }

  Widget _buildOptionTile(String type, BaristaCustomizationOption option) {
    final isInStock = option.isAvailable;

    Color accentColor;
    IconData optionIcon;

    if (type == 'bean') {
      accentColor = option.value.contains('dato')
          ? const Color(0xFF993300)
          : const Color(0xFF009624);
      optionIcon = Icons.coffee_rounded;
    } else if (type == 'milk') {
      accentColor = option.value.contains('oat')
          ? const Color(0xFFD97706)
          : const Color(0xFF2563EB);
      optionIcon = Icons.local_drink_rounded;
    } else if (type == 'sparkling') {
      accentColor = const Color(0xFF0D9488);
      optionIcon = Icons.bubble_chart_rounded;
    } else {
      accentColor = const Color(0xFF203E32);
      optionIcon = Icons.tune_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: const Color(0xFF203E32).withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF203E32).withValues(alpha: 0.08),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(optionIcon, color: accentColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        option.name,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15.5,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF203E32),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isInStock
                            ? const Color(0xFF203E32).withValues(alpha: 0.08)
                            : Colors.red.withValues(alpha: 0.09),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isInStock ? 'In Stock' : 'Out of Stock',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: isInStock
                              ? const Color(0xFF203E32)
                              : const Color(0xFFC2410C),
                        ),
                      ),
                    ),
                  ],
                ),
                if (option.subtitle.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    option.subtitle,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12.5,
                      color: const Color(0xFF203E32).withValues(alpha: 0.6),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          Switch(
            value: option.isAvailable,
            activeThumbColor: const Color(0xFF203E32),
            activeTrackColor: const Color(0xFF203E32).withValues(alpha: 0.4),
            onChanged: (val) => _toggleCustomization(
              type: type,
              option: option,
              newValue: val,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBeanBlendsCard(List<BaristaBeanBlend> beans) {
    if (_loading && beans.isEmpty) {
      return const BaristaCard(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(
            child: CircularProgressIndicator(color: Color(0xFF203E32)),
          ),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth >= 600;
        final cards = beans.map((bean) {
          final isInStock = bean.isAvailable;
          return BaristaCard(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: bean.value.contains('dato')
                          ? const Color(0xFF993300).withValues(alpha: 0.12)
                          : const Color(0xFF009624).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(
                      Icons.coffee_rounded,
                      color: bean.value.contains('dato')
                          ? const Color(0xFF993300)
                          : const Color(0xFF009624),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              bean.name,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 16.5,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF203E32),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: isInStock
                                    ? const Color(0xFF203E32).withValues(alpha: 0.08)
                                    : Colors.red.withValues(alpha: 0.09),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isInStock ? 'In Stock' : 'Out of Stock',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w800,
                                  color: isInStock
                                      ? const Color(0xFF203E32)
                                      : const Color(0xFFC2410C),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          bean.subtitle,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 13,
                            color: const Color(0xFF203E32).withValues(alpha: 0.6),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Switch(
                    value: bean.isAvailable,
                    activeThumbColor: const Color(0xFF203E32),
                    activeTrackColor: const Color(0xFF203E32).withValues(alpha: 0.4),
                    onChanged: (val) => _toggleBean(bean, val),
                  ),
                ],
              ),
            ),
          );
        }).toList();

        if (isWide && cards.length == 2) {
          return Row(
            children: [
              Expanded(child: cards[0]),
              const SizedBox(width: 14),
              Expanded(child: cards[1]),
            ],
          );
        }

        return Column(
          children: cards
              .map(
                (c) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: c,
                ),
              )
              .toList(),
        );
      },
    );
  }

  Widget _buildFilterBar(List<BaristaMenuCategory> categories) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Search bar
        TextField(
          controller: _searchController,
          onChanged: (val) => setState(() => _searchQuery = val.trim()),
          decoration: InputDecoration(
            hintText: 'Search drinks or items...',
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
        if (categories.isNotEmpty) ...[
          const SizedBox(height: 10),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildCategoryChip(
                  label: 'All',
                  isSelected: _selectedCategoryId == null,
                  onTap: () => setState(() => _selectedCategoryId = null),
                ),
                for (final cat in categories)
                  _buildCategoryChip(
                    label: cat.name,
                    isSelected: _selectedCategoryId == cat.id,
                    onTap: () => setState(() => _selectedCategoryId = cat.id),
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

  Widget _buildMenuItemRow(BaristaMenuCategory category, BaristaMenuItemAvailability item) {
    final isAvailable = item.isAvailable;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          // Icon / Image
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF203E32).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              item.allowChoiceOfBeans
                  ? Icons.local_cafe_rounded
                  : Icons.restaurant_rounded,
              color: const Color(0xFF203E32),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        item.name,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isAvailable
                              ? const Color(0xFF203E32)
                              : const Color(0xFF203E32).withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                    if (item.allowChoiceOfBeans) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: const Color(0xFF993300).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: const Text(
                          'Coffee Beans',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF993300),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  '${category.name}  •  RM ${double.tryParse(item.basePriceRm)?.toStringAsFixed(2) ?? item.basePriceRm}',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: const Color(0xFF203E32).withValues(alpha: 0.55),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          // Status Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: isAvailable
                  ? const Color(0xFF203E32).withValues(alpha: 0.08)
                  : const Color(0xFFC2410C).withValues(alpha: 0.09),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              isAvailable ? 'Available' : 'Sold Out',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isAvailable
                    ? const Color(0xFF203E32)
                    : const Color(0xFFC2410C),
              ),
            ),
          ),
          const SizedBox(width: 10),

          // Switch
          Switch(
            value: isAvailable,
            activeThumbColor: const Color(0xFF203E32),
            activeTrackColor: const Color(0xFF203E32).withValues(alpha: 0.4),
            onChanged: (val) => _toggleItem(item, val),
          ),
        ],
      ),
    );
  }
}
