import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/catalog_product_image.dart';

/// Unified Product Detail Page for all items (Drinks, Pastries, Merch, and Candles)
class ProductDetailPage extends StatefulWidget {
  final Map<String, dynamic> item;
  final String? initialBean;
  final int? initialEspressoShots;
  final String? initialTemperature;
  final String? initialMilk;
  final String? initialSweetness;
  final String? initialIceLevel;
  final String? initialOrderType;
  final String? initialRemarks;
  final int? initialQuantity;
  final bool isReorder;

  const ProductDetailPage({
    super.key,
    required this.item,
    this.initialBean,
    this.initialEspressoShots,
    this.initialTemperature,
    this.initialMilk,
    this.initialSweetness,
    this.initialIceLevel,
    this.initialOrderType,
    this.initialRemarks,
    this.initialQuantity,
    this.isReorder = false,
  });

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

/// Backwards compatibility aliases
typedef DrinkDetailPage = ProductDetailPage;
typedef SimpleProductDetailPage = ProductDetailPage;
typedef MontBrogaPage = ProductDetailPage;

class _ProductDetailPageState extends State<ProductDetailPage> {
  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

  String selectedBean = 'Dato Blend';
  int espressoShots = 1;
  String temperature = 'Hot';
  String milk = 'Fresh Milk';
  String sweetness = 'No Sugar';
  String iceLevel = 'Less Ice';
  String orderType = 'Take Away';
  String sparklingMixer = 'Ginger Ade';
  int quantity = 1;
  final TextEditingController remarksController = TextEditingController();

  String get _itemName => (widget.item['name'] ?? 'Item').toString();
  String get _itemCategory => (widget.item['category'] ?? '').toString();
  String get _itemProductKind =>
      (widget.item['productKindCode'] ?? '').toString();

  bool _flagEnabled(String key, {required bool fallback}) {
    if (widget.item.containsKey(key)) {
      final value = widget.item[key];
      if (value is bool) return value;
      if (value is num) return value.toInt() != 0;
      if (value is String) {
        final normalized = value.toLowerCase().trim();
        return normalized == 'true' || normalized == '1' || normalized == 'yes';
      }
    }
    return fallback;
  }

  bool get _isPastry {
    final name = _itemName.toLowerCase();
    final category = _itemCategory.toLowerCase();
    final productKind = _itemProductKind.toLowerCase();
    return productKind == 'food' &&
        (category.contains('pastry') ||
            category.contains('food') ||
            name.contains('curry puff'));
  }

  bool get _isMerchandise {
    final name = _itemName.toLowerCase();
    final category = _itemCategory.toLowerCase();
    final productKind = _itemProductKind.toLowerCase();
    return productKind == 'merchandise' ||
        category.contains('merch') ||
        name.contains('cup') ||
        name.contains('tumbler');
  }

  bool get _isCandle {
    final name = _itemName.toLowerCase();
    final category = _itemCategory.toLowerCase();
    final productKind = _itemProductKind.toLowerCase();
    return productKind == 'candle' ||
        category.contains('candle') ||
        name.contains('candle');
  }

  /// Whether this item is a beverage/drink or a simple retail/food product
  bool get _isDrink {
    final productKind = _itemProductKind.toLowerCase();
    return productKind == 'drink' ||
        (!_isPastry && !_isMerchandise && !_isCandle);
  }

  double get _imageScale {
    if (_isPastry) return 1.35;
    if (_isCandle) return 1.15;
    if (_isMerchandise) return 1.15;
    return 1.0;
  }

  bool get _isMocktail {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('sparkling') ||
        cat.contains('mocktail') ||
        name.contains('boijito') ||
        name.contains('peach') ||
        name.contains('fuji fizz') ||
        name.contains('mimosa') ||
        name.contains('onde');
  }

  bool get _isTea {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('tea') ||
        name.contains('jasmine') ||
        name.contains('solero');
  }

  bool get _isMatcha {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('matcha') || name.contains('matcha');
  }

  bool get _isChocolate {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('chocolate') || name.contains('chocolate');
  }

  bool get _isMilkshake {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('milkshake') ||
        name.contains('milkshake') ||
        name.contains('pinky blush') ||
        name.contains('paddle pop');
  }

  bool get _isColdOnly {
    if (_isMocktail || _isMilkshake) return true;
    final name = _itemName.toLowerCase();
    if (name.contains('mont broga') ||
        name.contains('shakerato') ||
        name.contains('yuzukano') ||
        name.contains('senja di broga') ||
        name.contains('espresso bomb') ||
        name.contains('blue cloud') ||
        name.contains('solero') ||
        name.contains('cloudy jasmine') ||
        name.contains('fuji fizz') ||
        name.contains('onde')) {
      return true;
    }
    return false;
  }

  bool get _isHotOnly {
    final name = _itemName.toLowerCase();
    if (name == 'espresso' || name.contains('flat white')) {
      return true;
    }
    return false;
  }

  bool get _hasChoiceOfBeans {
    return _flagEnabled(
      'allowChoiceOfBeans',
      fallback: _isDrink &&
          !(_isMocktail || _isMatcha || _isChocolate || _isMilkshake || _isTea),
    );
  }

  bool get _hasEspressoShot {
    return _flagEnabled(
      'allowEspressoShot',
      fallback: _isDrink &&
          !(_isMocktail ||
              _isChocolate ||
              _isMilkshake ||
              _isMatcha ||
              _isTea) &&
          !_itemName.toLowerCase().contains('v60'),
    );
  }

  bool get _hasChoiceOfMilk {
    return _flagEnabled(
      'allowChoiceOfMilk',
      fallback: () {
        if (!_isDrink) return false;
        final name = _itemName.toLowerCase();
        if (_isMocktail || _isTea) {
          return false;
        }
        if (name.contains('mont broga') ||
            name.contains('shakerato') ||
            name.contains('yuzukano') ||
            name.contains('senja di broga') ||
            name.contains('espresso bomb') ||
            name.contains('blue cloud') ||
            name.contains('v60') ||
            name == 'espresso' ||
            name.contains('solero')) {
          return false;
        }
        return true;
      }(),
    );
  }

  bool get _hasTemperatureOption => _flagEnabled(
        'allowTemperature',
        fallback: _isDrink && !_isColdOnly && !_isHotOnly,
      );

  bool get _hasIceOption {
    return _flagEnabled(
      'allowIceLevel',
      fallback: () {
        if (!_isDrink) return false;
        if (_isHotOnly) return false;
        if (_isColdOnly) return true;
        return temperature == 'Cold';
      }(),
    );
  }

  bool get _hasSparklingMixerOption {
    return _flagEnabled(
      'allowSparklingMixer',
      fallback: _isDrink && _itemName.toLowerCase().contains('espresso bomb'),
    );
  }

  bool get _hasChoiceOfSweetness => _flagEnabled(
        'allowChoiceOfSweetness',
        fallback: _isDrink,
      );

  bool get _hasOrderType => _flagEnabled(
        'allowOrderType',
        fallback: _isDrink,
      );

  bool get _hasRemarks => _flagEnabled(
        'allowRemarks',
        fallback: _isDrink,
      );

  @override
  void initState() {
    super.initState();
    if (widget.initialQuantity != null && widget.initialQuantity! > 0) {
      quantity = widget.initialQuantity!;
    }
    if (_isDrink) {
      if (widget.initialBean != null) selectedBean = widget.initialBean!;
      if (widget.initialEspressoShots != null) {
        espressoShots = widget.initialEspressoShots!;
      }
      if (widget.initialTemperature != null) {
        temperature = widget.initialTemperature!;
      } else if (_isColdOnly) {
        temperature = 'Cold';
      } else if (_isHotOnly) {
        temperature = 'Hot';
      }
      if (widget.initialMilk != null) milk = widget.initialMilk!;
      if (widget.initialSweetness != null) sweetness = widget.initialSweetness!;
      if (widget.initialIceLevel != null) iceLevel = widget.initialIceLevel!;
      if (widget.initialOrderType != null) orderType = widget.initialOrderType!;
      if (widget.initialRemarks != null && widget.initialRemarks != 'None') {
        remarksController.text = widget.initialRemarks!;
      }
    }
  }

  double get _itemBasePrice {
    final raw = widget.item['basePriceRm']?.toString() ??
        widget.item['price']?.toString() ??
        '16.90';
    final clean = raw.replaceAll('RM', '').replaceAll(r'$', '').trim();
    final parsed = double.tryParse(clean) ?? 16.90;
    return parsed;
  }

  String? get _itemDescription {
    final description = widget.item['desc']?.toString().trim() ?? '';
    return description.isEmpty ? null : description;
  }

  double get totalPrice {
    double basePrice = _itemBasePrice;
    if (_isDrink) {
      if (_hasEspressoShot) {
        if (espressoShots == 2) basePrice += 3.00;
        if (espressoShots == 3) basePrice += 6.00;
      }
      if (_hasChoiceOfMilk) {
        if (milk == 'Oat Milk') basePrice += 3.00;
      }
    }
    return basePrice * quantity;
  }

  @override
  void dispose() {
    remarksController.dispose();
    super.dispose();
  }

  Widget _buildSectionTitle(String title,
      {bool required = true, String subtitle = ''}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0, top: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 17,
              fontWeight: FontWeight.w900,
              color: Colors.black,
            ),
          ),
          if (required)
            Text(
              'Pick 1 *',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 11,
                color: AppColors.deepTeal,
                fontWeight: FontWeight.bold,
              ),
            )
          else if (subtitle.isNotEmpty)
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
    Widget? icon,
    bool isGradient = false,
    List<Color>? gradientColors,
    double? height,
    bool isExpanded = true,
  }) {
    bool isSelected = value == groupValue;
    final defaultMinHeight = icon != null ? 125.0 : 82.0;

    Widget cardChild = AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      constraints: BoxConstraints(
        minHeight: height ?? defaultMinHeight,
      ),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      decoration: BoxDecoration(
        color: isSelected ? (isGradient ? null : color) : Colors.white,
        gradient: (isSelected && isGradient && gradientColors != null)
            ? LinearGradient(
                colors: gradientColors,
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
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
                color: (isGradient ? gradientColors!.first : color)
                    .withValues(alpha: 0.25),
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
          if (icon != null) ...[
            const SizedBox(height: 4),
            Opacity(opacity: isSelected ? 1.0 : 0.5, child: icon),
            const SizedBox(height: 4),
          ],
          if (subtitle.isNotEmpty) ...[
            if (icon == null) const SizedBox(height: 3),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 11,
                fontWeight: FontWeight.bold,
                color: isSelected
                    ? textColor.withValues(alpha: 0.9)
                    : Colors.grey.shade400,
              ),
            ),
          ]
        ],
      ),
    );

    Widget clickableContent = GestureDetector(
      onTap: () => onChanged(value),
      child: cardChild,
    );

    return isExpanded ? Expanded(child: clickableContent) : clickableContent;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: bgColor,
            elevation: 0,
            pinned: true,
            leading: const SizedBox.shrink(),
            actions: [
              IconButton(
                icon: Icon(Icons.close, color: AppColors.deepTeal),
                onPressed: () => InteractiveFillingLoader.showPop(context),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Transform.scale(
                    scale: _imageScale,
                    child: CatalogProductImage(
                      imageUrl: widget.item['image_url']?.toString(),
                      height: 200,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _itemName,
                        style: const TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                        ),
                      ),
                      if (_itemDescription != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          _itemDescription!,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                                color: Colors.black.withValues(alpha: 0.1)),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Text(
                              'RM ',
                              style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold),
                            ),
                            Text(
                              _itemBasePrice.toStringAsFixed(2),
                              style: const TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),

                      // Drink Customization Options (Only shown if _isDrink)
                      if (_isDrink) ...[
                        if (_hasChoiceOfBeans) ...[
                          _buildSectionTitle('Choice of Beans'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'DATO\nBLEND',
                                subtitle: 'Bold & Dark\nChocolatey',
                                value: 'Dato Blend',
                                groupValue: selectedBean,
                                onChanged: (v) =>
                                    setState(() => selectedBean = v),
                                color: Colors.transparent,
                                textColor: Colors.white,
                                isGradient: true,
                                gradientColors: [
                                  const Color(0xFFC76B26),
                                  const Color(0xFF7A1800)
                                ],
                                icon: Image.asset('assets/images/dato.png',
                                    height: 28, color: Colors.white),
                              ),
                              _buildOptionCard(
                                title: 'DATIN\nBLEND',
                                subtitle: 'Citrus & Fruity',
                                value: 'Datin Blend',
                                groupValue: selectedBean,
                                onChanged: (v) =>
                                    setState(() => selectedBean = v),
                                color: Colors.transparent,
                                textColor: Colors.white,
                                isGradient: true,
                                gradientColors: [
                                  const Color(0xFFE91E63),
                                  const Color(0xFF009624)
                                ],
                                icon: Image.asset('assets/images/datin.png',
                                    height: 28, color: Colors.white),
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasEspressoShot) ...[
                          _buildSectionTitle('Espresso Shot',
                              required: false, subtitle: 'Optional'),
                          SliderTheme(
                            data: SliderThemeData(
                              activeTrackColor: orangeColor,
                              inactiveTrackColor:
                                  orangeColor.withValues(alpha: 0.2),
                              thumbColor: orangeColor,
                              trackHeight: 4.0,
                              tickMarkShape: const RoundSliderTickMarkShape(
                                  tickMarkRadius: 8.0),
                              activeTickMarkColor: orangeColor,
                              inactiveTickMarkColor:
                                  orangeColor.withValues(alpha: 0.2),
                            ),
                            child: Slider(
                              value: espressoShots.toDouble(),
                              min: 1,
                              max: 3,
                              divisions: 2,
                              onChanged: (v) =>
                                  setState(() => espressoShots = v.toInt()),
                            ),
                          ),
                          Padding(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 24.0),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                const Column(
                                  children: [
                                    Text(
                                      '1',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    Text(
                                      '+0.00',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 10,
                                        color: Colors.transparent,
                                      ),
                                    ),
                                  ],
                                ),
                                Column(
                                  children: [
                                    const Text(
                                      '2',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    Text(
                                      '+3.00',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: orangeColor,
                                      ),
                                    ),
                                  ],
                                ),
                                Column(
                                  children: [
                                    const Text(
                                      '3',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontWeight: FontWeight.bold,
                                        color: Colors.black54,
                                      ),
                                    ),
                                    Text(
                                      '+6.00',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: orangeColor,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasTemperatureOption) ...[
                          _buildSectionTitle('Choice of Temperature'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'HOT',
                                subtitle: '+ 0.00',
                                value: 'Hot',
                                groupValue: temperature,
                                onChanged: (v) =>
                                    setState(() => temperature = v),
                                color: const Color(0xFFE63900),
                                textColor: Colors.white,
                              ),
                              _buildOptionCard(
                                title: 'COLD',
                                subtitle: '+ 0.00',
                                value: 'Cold',
                                groupValue: temperature,
                                onChanged: (v) =>
                                    setState(() => temperature = v),
                                color: const Color(0xFF66C2E6),
                                textColor: Colors.white,
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasSparklingMixerOption) ...[
                          _buildSectionTitle('Choice of Sparkling'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'GINGER\nADE',
                                subtitle: '+ 0.00',
                                value: 'Ginger Ade',
                                groupValue: sparklingMixer,
                                onChanged: (v) =>
                                    setState(() => sparklingMixer = v),
                                color: const Color(0xFFC76B26),
                                textColor: Colors.white,
                              ),
                              _buildOptionCard(
                                title: 'TONIC\nWATER',
                                subtitle: '+ 0.00',
                                value: 'Tonic Water',
                                groupValue: sparklingMixer,
                                onChanged: (v) =>
                                    setState(() => sparklingMixer = v),
                                color: const Color(0xFF007AEC),
                                textColor: Colors.white,
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasChoiceOfMilk) ...[
                          _buildSectionTitle('Choice of Milk'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'FRESH\nMILK',
                                subtitle: '+ 0.00',
                                value: 'Fresh Milk',
                                groupValue: milk,
                                onChanged: (v) => setState(() => milk = v),
                                color: const Color(0xFF007AEC),
                                textColor: Colors.white,
                              ),
                              _buildOptionCard(
                                title: 'OAT\nMILK',
                                subtitle: 'OATSIDE\n+ 3.00',
                                value: 'Oat Milk',
                                groupValue: milk,
                                onChanged: (v) => setState(() => milk = v),
                                color: const Color(0xFF995C00),
                                textColor: Colors.white,
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasChoiceOfSweetness) ...[
                          _buildSectionTitle('Choice of Sweetness'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'NO\nSUGAR',
                                subtitle: '+ 0.00',
                                value: 'No Sugar',
                                groupValue: sweetness,
                                onChanged: (v) => setState(() => sweetness = v),
                                color: const Color(0xFF7BDB5C),
                                textColor: Colors.white,
                              ),
                              _buildOptionCard(
                                title: 'LESS\nSWEET',
                                subtitle: '+ 0.00',
                                value: 'Less Sweet',
                                groupValue: sweetness,
                                onChanged: (v) => setState(() => sweetness = v),
                                color: const Color(0xFFFF7A00),
                                textColor: Colors.white,
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: MediaQuery.of(context).size.width * 0.45,
                                child: _buildOptionCard(
                                  title: 'REGULAR\nSWEET',
                                  subtitle: '+ 0.00',
                                  value: 'Regular Sweet',
                                  groupValue: sweetness,
                                  onChanged: (v) =>
                                      setState(() => sweetness = v),
                                  color: const Color(0xFFD4A017),
                                  textColor: Colors.white,
                                  isExpanded: false,
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasIceOption) ...[
                          _buildSectionTitle('Ice Level'),
                          Row(
                            children: [
                              _buildOptionCard(
                                title: 'LESS\nICE',
                                subtitle: '+ 0.00',
                                value: 'Less Ice',
                                groupValue: iceLevel,
                                onChanged: (v) => setState(() => iceLevel = v),
                                color: const Color(0xFF6B3AB7),
                                textColor: Colors.white,
                              ),
                              _buildOptionCard(
                                title: 'REGULAR\nICE',
                                subtitle: '+ 0.00',
                                value: 'Regular Ice',
                                groupValue: iceLevel,
                                onChanged: (v) => setState(() => iceLevel = v),
                                color: const Color(0xFFD47A88),
                                textColor: Colors.white,
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasOrderType) ...[
                          _buildSectionTitle('Order Type'),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: MediaQuery.of(context).size.width * 0.45,
                                child: _buildOptionCard(
                                  title: 'TAKE\nAWAY',
                                  subtitle: '',
                                  value: 'Take Away',
                                  groupValue: orderType,
                                  onChanged: (v) =>
                                      setState(() => orderType = v),
                                  color: const Color(0xFFFF6B5C),
                                  textColor: Colors.white,
                                  isExpanded: false,
                                ),
                              ),
                            ],
                          ),
                          const Divider(height: 24),
                        ],
                        if (_hasRemarks) ...[
                          _buildSectionTitle('Remarks', required: false),
                          TextField(
                            controller: remarksController,
                            maxLines: 4,
                            decoration: InputDecoration(
                              hintText: 'Add your remark',
                              hintStyle: const TextStyle(
                                  fontFamily: 'Afacad', color: Colors.black38),
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(
                                    color: orangeColor.withValues(alpha: 0.5)),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(
                                    color: orangeColor.withValues(alpha: 0.5)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: orangeColor),
                              ),
                            ),
                          ),
                          const SizedBox(height: 40),
                        ],
                      ] else ...[
                        const SizedBox(height: 20),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
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
                  Row(
                    children: [
                      const Text(
                        'RM ',
                        style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12,
                            fontWeight: FontWeight.bold),
                      ),
                      Text(
                        totalPrice.toStringAsFixed(2),
                        style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 17,
                            fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: orangeColor),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          constraints:
                              const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            if (quantity > 1) {
                              setState(() => quantity--);
                            }
                          },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 10.0),
                          child: Text(
                            quantity.toString(),
                            style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 16,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          constraints:
                              const BoxConstraints(minWidth: 36, minHeight: 36),
                          padding: EdgeInsets.zero,
                          color: Colors.black54,
                          onPressed: () {
                            setState(() => quantity++);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        if (!_isDrink) {
                          AppNotification.showSuccess(
                            context,
                            'Added $quantity x $_itemName to cart!',
                            icon: Icons.shopping_bag_outlined,
                          );
                          InteractiveFillingLoader.showPop(context);
                        } else {
                          // TODO: Add to cart logic
                          Navigator.pop(context);
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: orangeColor,
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
