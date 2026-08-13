import 'package:flutter/material.dart';
import '../services/app_session_service.dart';
import '../services/cart_service.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';
import '../widgets/catalog_product_image.dart';

class MontBrogaPage extends StatefulWidget {
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

  const MontBrogaPage({
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
  State<MontBrogaPage> createState() => _MontBrogaPageState();
}

class _MontBrogaPageState extends State<MontBrogaPage> {
  final AppSessionService _session = AppSessionService.instance;
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

  @override
  void initState() {
    super.initState();
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
    if (widget.initialQuantity != null) quantity = widget.initialQuantity!;

    if (widget.isReorder) {
      // Reorder customizations restored automatically
    }
  }

  double get _itemBasePrice {
    final raw = widget.item['price']?.toString() ?? '16.90';
    final clean = raw.replaceAll('RM', '').replaceAll(r'$', '').trim();
    final parsed = double.tryParse(clean) ?? 16.90;
    final image = (widget.item['image']?.toString() ?? '').toLowerCase();
    if (image.contains('pastries')) {
      return parsed;
    } else if (image.contains('merchandies') || image.contains('candle')) {
      return AppColors.getDiscountedMerchPrice(parsed);
    } else {
      return AppColors.getDiscountedDrinkPrice(parsed);
    }
  }

  String get _itemName => (widget.item['name'] ?? '').toString();
  String get _itemCategory => (widget.item['category'] ?? '').toString();

  bool get _isMocktail {
    final name = _itemName.toLowerCase();
    final cat = _itemCategory.toLowerCase();
    return cat.contains('mocktail') ||
        name.contains('boijito') ||
        name.contains('peach') ||
        name.contains('fuji fizz') ||
        name.contains('mimosa') ||
        name.contains('onde');
  }

  bool get _isTea {
    final name = _itemName.toLowerCase();
    return name.contains('jasmine') || name.contains('solero');
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
    return name.contains('milkshake') ||
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

  /// Whether this drink uses coffee beans & has Choice of Beans
  bool get _hasChoiceOfBeans {
    if (_isMocktail || _isMatcha || _isChocolate || _isMilkshake || _isTea) {
      return false;
    }
    return true;
  }

  /// Whether this drink can add extra espresso shots
  bool get _hasEspressoShot {
    if (_isMocktail || _isChocolate || _isMilkshake || _isMatcha || _isTea) {
      return false;
    }
    final name = _itemName.toLowerCase();
    if (name.contains('v60')) {
      return false;
    }
    return true;
  }

  /// Whether this drink has milk options (Fresh Milk, Oat Milk)
  bool get _hasChoiceOfMilk {
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
  }

  /// Whether this drink has temperature options (Hot / Cold)
  bool get _hasTemperatureOption => !_isColdOnly && !_isHotOnly;

  /// Whether this drink shows ice level options
  bool get _hasIceOption {
    if (_isHotOnly) return false;
    if (_isColdOnly) return true;
    return temperature == 'Cold';
  }

  /// Espresso Bomb specific mixer selection
  bool get _hasSparklingMixerOption {
    return _itemName.toLowerCase().contains('espresso bomb');
  }

  String get _itemDescription {
    if (widget.item['desc'] != null &&
        widget.item['desc'].toString().isNotEmpty) {
      return widget.item['desc'].toString();
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
    if (name.contains('pinky blush')) {
      return 'Creamy strawberry, delicate banana puree, mix and shaken with milk.';
    }
    if (name.contains('solero fizz')) {
      return 'Bright citrus notes with sparkling soda and creamy, silky cold foam.';
    }
    if (name.contains('paddle pop')) {
      return 'Creamy strawberry, delicate banana puree, mix and shaken with milk.';
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
    if (name.contains('espresso bomb')) {
      return 'The trendy espresso bomb is here. Choice of sparkling of ginger ade or tonic water.';
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
    double basePrice = _itemBasePrice;
    if (_hasEspressoShot) {
      if (espressoShots == 2) basePrice += 3.00;
      if (espressoShots == 3) basePrice += 6.00;
    }
    if (_hasChoiceOfMilk) {
      if (milk == 'Oat Milk') basePrice += 3.00;
    }
    return basePrice * quantity;
  }

  int get _baseTokenPrice {
    final itemId = widget.item['id'];
    if (itemId is! int) return _itemBasePrice.round();
    final catalogItem = _session.allMenuItems.cast<dynamic>().firstWhere(
          (item) => item?.id == itemId,
          orElse: () => null,
        );
    if (catalogItem == null) return _itemBasePrice.round();
    final tierPrice = catalogItem.tokenPrices[_session.tier];
    return tierPrice ?? _itemBasePrice.round();
  }

  List<CartModifier> get _cartModifiers {
    final modifiers = <CartModifier>[];

    if (_hasChoiceOfBeans) {
      modifiers.add(
        CartModifier(
          groupName: 'Choice of Beans',
          optionName: selectedBean,
        ),
      );
    }

    if (_hasEspressoShot) {
      final priceDelta = espressoShots == 2
          ? 3.0
          : espressoShots == 3
              ? 6.0
              : 0.0;
      final tokenDelta = espressoShots == 2
          ? 3
          : espressoShots == 3
              ? 6
              : 0;
      modifiers.add(
        CartModifier(
          groupName: 'Espresso Shot',
          optionName: '$espressoShots shot${espressoShots > 1 ? 's' : ''}',
          priceDeltaRm: priceDelta,
          tokenPriceDelta: tokenDelta,
        ),
      );
    }

    if (_hasTemperatureOption) {
      modifiers.add(
        CartModifier(
          groupName: 'Choice of Temperature',
          optionName: temperature,
        ),
      );
    }

    if (_hasSparklingMixerOption) {
      modifiers.add(
        CartModifier(
          groupName: 'Choice of Sparkling',
          optionName: sparklingMixer,
        ),
      );
    }

    if (_hasChoiceOfMilk) {
      modifiers.add(
        CartModifier(
          groupName: 'Choice of Milk',
          optionName: milk,
          priceDeltaRm: milk == 'Oat Milk' ? 3.0 : 0.0,
          tokenPriceDelta: milk == 'Oat Milk' ? 3 : 0,
        ),
      );
    }

    modifiers.add(
      CartModifier(
        groupName: 'Choice of Sweetness',
        optionName: sweetness,
      ),
    );

    if (_hasIceOption) {
      modifiers.add(
        CartModifier(
          groupName: 'Ice Level',
          optionName: iceLevel,
        ),
      );
    }

    modifiers.add(
      CartModifier(
        groupName: 'Order Type',
        optionName: orderType,
      ),
    );

    return modifiers;
  }

  String get _displayDetails {
    final values = <String>[];
    if (_hasTemperatureOption || _isColdOnly || _isHotOnly) {
      values.add(temperature);
    }
    values.add(sweetness);
    if (_hasIceOption) {
      values.add(iceLevel);
    }
    if (_hasChoiceOfMilk) {
      values.add(milk);
    }
    if (_hasChoiceOfBeans) {
      values.add(selectedBean);
    }
    if (_hasSparklingMixerOption) {
      values.add(sparklingMixer);
    }
    return values.join(' / ');
  }

  @override
  void dispose() {
    remarksController.dispose();
    super.dispose();
  }

  void _dismissKeyboard() {
    FocusScope.of(context).unfocus();
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
      body: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _dismissKeyboard,
        child: CustomScrollView(
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
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
                    child: CatalogProductImage(
                      assetPath: widget.item['image']?.toString(),
                      imageUrl: widget.item['image_url']?.toString(),
                      height: 200,
                      fit: BoxFit.contain,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                      Text(
                        widget.item['name']?.toString() ?? 'Mont Broga',
                        style: const TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _itemDescription,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black87,
                        ),
                      ),
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
                      // Options
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
                          padding: const EdgeInsets.symmetric(horizontal: 24.0),
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
                              onChanged: (v) => setState(() => temperature = v),
                              color: const Color(0xFFE63900),
                              textColor: Colors.white,
                            ),
                            _buildOptionCard(
                              title: 'COLD',
                              subtitle: '+ 0.00',
                              value: 'Cold',
                              groupValue: temperature,
                              onChanged: (v) => setState(() => temperature = v),
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
                              onChanged: (v) => setState(() => sweetness = v),
                              color: const Color(0xFFD4A017),
                              textColor: Colors.white,
                              isExpanded: false,
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 24),
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
                              onChanged: (v) => setState(() => orderType = v),
                              color: const Color(0xFFFF6B5C),
                              textColor: Colors.white,
                              isExpanded: false,
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 24),
                      _buildSectionTitle('Remarks', required: false),
                      TextField(
                        controller: remarksController,
                        maxLines: 4,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _dismissKeyboard(),
                        onTapOutside: (_) => _dismissKeyboard(),
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
                    ),
                  ),
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
                        final selectedStore = _session.selectedStore;
                        if (selectedStore == null) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Please select a store first.'),
                              backgroundColor: orangeColor,
                            ),
                          );
                          return;
                        }

                        CartService.instance.addItem(
                          storeId: selectedStore.id,
                          storeName: selectedStore.name,
                          item: CartItem(
                            id: '${widget.item['code'] ?? _itemName}-${DateTime.now().microsecondsSinceEpoch}',
                            menuItemId: (widget.item['id'] as num?)?.toInt() ?? 0,
                            menuItemCode: widget.item['code']?.toString() ?? _itemName,
                            name: _itemName,
                            imageAssetPath: widget.item['image']?.toString(),
                            imageUrl: widget.item['image_url']?.toString(),
                            basePriceRm: _itemBasePrice,
                            tokenPrice: _baseTokenPrice,
                            quantity: quantity,
                            remarks: remarksController.text.trim().isEmpty
                                ? null
                                : remarksController.text.trim(),
                            displayDetails: _displayDetails,
                            modifiers: _cartModifiers,
                          ),
                        );

                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Added $quantity x $_itemName to cart!'),
                            duration: const Duration(seconds: 2),
                            backgroundColor: orangeColor,
                            behavior: SnackBarBehavior.floating,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        );
                        InteractiveFillingLoader.showPop(context);
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
