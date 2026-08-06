import 'package:flutter/material.dart';

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
  final Color orangeColor = const Color(0xFF2E5E58);
  final Color bgColor = Colors.white;

  String selectedBean = 'Dato Blend';
  int espressoShots = 1;
  String temperature = 'Hot';
  String milk = 'Fresh Milk';
  String sweetness = 'No Sugar';
  String iceLevel = 'Less Ice';
  String orderType = 'Take Away';
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
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Row(
                children: [
                  Icon(Icons.history_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Customizations restored from previous order!',
                    style: TextStyle(
                        fontFamily: 'Afacad', fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              backgroundColor: orangeColor,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              duration: const Duration(seconds: 3),
            ),
          );
        }
      });
    }
  }

  double get totalPrice {
    double basePrice = 16.90;
    if (espressoShots == 2) basePrice += 3.00;
    if (espressoShots == 3) basePrice += 6.00;
    if (milk == 'Oat Milk') basePrice += 3.00;
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
      padding: const EdgeInsets.only(bottom: 12.0, top: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: Colors.black,
            ),
          ),
          if (required)
            const Text(
              'Pick 1 *',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                color: Color(0xFF2E5E58),
                fontWeight: FontWeight.bold,
              ),
            )
          else if (subtitle.isNotEmpty)
            Text(
              subtitle,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
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
  }) {
    bool isSelected = value == groupValue;
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(value),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: 180,
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
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isSelected
                  ? (isGradient ? gradientColors!.first : color)
                  : Colors.grey.shade300,
              width: 2,
            ),
            boxShadow: [
              if (isSelected)
                BoxShadow(
                    color: (isGradient ? gradientColors!.first : color)
                        .withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4))
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (title.isNotEmpty)
                Text(
                  title.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: isSelected ? textColor : Colors.grey.shade500,
                    height: 1.1,
                  ),
                ),
              if (icon != null) ...[
                const SizedBox(height: 12),
                Opacity(opacity: isSelected ? 1.0 : 0.5, child: icon),
                const SizedBox(height: 12),
              ],
              if (subtitle.isNotEmpty) ...[
                if (icon == null) const SizedBox(height: 16),
                Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isSelected
                        ? textColor.withValues(alpha: 0.9)
                        : Colors.grey.shade400,
                  ),
                ),
              ]
            ],
          ),
        ),
      ),
    );
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
                icon: const Icon(Icons.close, color: Color(0xFF2E5E58)),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Image.asset(
                    'assets/images/drinks/MONT BROGA.png',
                    height: 250,
                    fit: BoxFit.contain,
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Mont Broga',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.w900,
                          color: Colors.black,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Black coffee layered with orangey cold foam and orange zest.',
                        style: TextStyle(
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
                        child: const Row(
                          children: [
                            Text(
                              'RM ',
                              style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold),
                            ),
                            Text(
                              '16.90',
                              style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      // Options
                      _buildSectionTitle('Choice of Beans'),
                      Row(
                        children: [
                          _buildOptionCard(
                            title: 'DATO\nBLEND',
                            subtitle: 'Bold & Dark\nChocolatey',
                            value: 'Dato Blend',
                            groupValue: selectedBean,
                            onChanged: (v) => setState(() => selectedBean = v),
                            color: Colors.transparent,
                            textColor: Colors.white,
                            isGradient: true,
                            gradientColors: [
                              const Color(0xFFC76B26),
                              const Color(0xFF7A1800)
                            ],
                            icon: Image.asset('assets/images/dato.png',
                                height: 40, color: Colors.white),
                          ),
                          _buildOptionCard(
                            title: 'DATIN\nBLEND',
                            subtitle: 'Citrus & Fruity',
                            value: 'Datin Blend',
                            groupValue: selectedBean,
                            onChanged: (v) => setState(() => selectedBean = v),
                            color: Colors.transparent,
                            textColor: Colors.white,
                            isGradient: true,
                            gradientColors: [
                              const Color(0xFFE91E63),
                              const Color(0xFF009624)
                            ],
                            icon: Image.asset('assets/images/datin.png',
                                height: 40, color: Colors.white),
                          ),
                        ],
                      ),
                      const Divider(height: 40),
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(left: 8.0),
                            child: Text('1',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    color: Colors.black54)),
                          ),
                          Column(
                            children: [
                              const Text('2',
                                  style: TextStyle(
                                      fontFamily: 'Afacad',
                                      color: Colors.black54)),
                              Text('+3.00',
                                  style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 10,
                                      color: orangeColor)),
                            ],
                          ),
                          Padding(
                            padding: const EdgeInsets.only(right: 8.0),
                            child: Column(
                              children: [
                                const Text('3',
                                    style: TextStyle(
                                        fontFamily: 'Afacad',
                                        color: Colors.black54)),
                                Text('+6.00',
                                    style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 10,
                                        color: orangeColor)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 40),
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
                      const Divider(height: 40),
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
                      const Divider(height: 40),
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
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 40),
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
                      const Divider(height: 40),
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
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 40),
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
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
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
                        fontSize: 20,
                        color: Colors.black87),
                  ),
                  Row(
                    children: [
                      const Text(
                        'RM ',
                        style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.bold),
                      ),
                      Text(
                        totalPrice.toStringAsFixed(2),
                        style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 22,
                            fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: orangeColor),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove),
                          color: Colors.black54,
                          onPressed: () {
                            if (quantity > 1) {
                              setState(() => quantity--);
                            }
                          },
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                          child: Text(
                            quantity.toString(),
                            style: const TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 20,
                                fontWeight: FontWeight.bold),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add),
                          color: Colors.black54,
                          onPressed: () {
                            setState(() => quantity++);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        // TODO: Add to cart logic
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: orangeColor,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                      child: const Text(
                        'ADD TO CART',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
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
