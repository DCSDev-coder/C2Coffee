import 'package:flutter/material.dart';
import '../utils/global_state.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';

class OrderConfirmationPage extends StatefulWidget {
  final int initialQuantity;

  const OrderConfirmationPage({super.key, this.initialQuantity = 1});

  @override
  State<OrderConfirmationPage> createState() => _OrderConfirmationPageState();
}

class _OrderConfirmationPageState extends State<OrderConfirmationPage> {
  late int _quantity;
  double get _basePrice => AppColors.getDiscountedDrinkPrice(16.90);
  String? _selectedVoucherTitle;
  double _voucherDiscount = 0.0;

  Color get orangeColor => AppColors.deepTeal;

  double get _totalPrice {
    final subtotal = _basePrice * _quantity;
    final total = subtotal - _voucherDiscount;
    return total < 0 ? 0.0 : total;
  }

  @override
  void initState() {
    super.initState();
    _quantity = widget.initialQuantity;
  }

  void _showVoucherSelectionModal() {
    final List<Map<String, dynamic>> vouchers = [
      {
        'title': 'Buy 1 Free 1 Any Coffee',
        'discountText': '-RM ${_basePrice.toStringAsFixed(2)}',
        'discountValue': _basePrice,
        'badge': '%',
        'terms': 'Applies 1 free handcrafted coffee item'
      },
      {
        'title': 'RM 5 Off Handcrafted Drink',
        'discountText': '-RM 5.00',
        'discountValue': 5.00,
        'badge': 'RM5',
        'terms': 'RM 5 discount on your order'
      },
      {
        'title': '10% Off Total Order',
        'discountText': '-10%',
        'discountValue': (_basePrice * _quantity) * 0.10,
        'badge': '10%',
        'terms': '10% discount on total basket subtotal'
      },
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: 24 + MediaQuery.paddingOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Select Voucher',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.grey),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Column(
                children: vouchers.map((v) {
                  final isSelected = _selectedVoucherTitle == v['title'];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _selectedVoucherTitle = v['title'] as String;
                          _voucherDiscount =
                              (v['discountValue'] as num).toDouble();
                        });
                        Navigator.pop(context);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.deepTeal.withValues(alpha: 0.08)
                              : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: isSelected
                                ? AppColors.deepTeal
                                : AppColors.border,
                            width: isSelected ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            Image.asset(
                              'assets/images/voucher.png',
                              width: 40,
                              height: 40,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    v['title'] as String,
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    v['terms'] as String,
                                    style: const TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 12,
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              v['discountText'] as String,
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.deepTeal,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              if (_selectedVoucherTitle != null)
                Center(
                  child: TextButton.icon(
                    onPressed: () {
                      setState(() {
                        _selectedVoucherTitle = null;
                        _voucherDiscount = 0.0;
                      });
                      Navigator.pop(context);
                    },
                    icon: const Icon(Icons.clear, size: 16, color: Colors.red),
                    label: const Text(
                      'Remove selected voucher',
                      style:
                          TextStyle(color: Colors.red, fontFamily: 'Afacad'),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color bgColor = Colors.white;

    return Scaffold(
      backgroundColor: bgColor,
      body: Stack(
        children: [
          // Main Content Area
          Column(
            children: [
              // Custom Header
              Container(
                width: double.infinity,
                padding: EdgeInsets.only(
                    top: MediaQuery.paddingOf(context).top + 14,
                    bottom: 16,
                    left: 20,
                    right: 20),
                decoration: BoxDecoration(
                  color: AppColors.deepTeal,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: () => InteractiveFillingLoader.showPop(context),
                        child: const Icon(Icons.arrow_back_ios,
                            color: Colors.white, size: 20),
                      ),
                    ),
                    const Text(
                      'ORDER CONFIRMATION',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ],
                ),
              ),

              // Scrollable Content
              Expanded(
                child: SingleChildScrollView(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Subtitle
                      Text(
                        'Your order',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: orangeColor,
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Order Card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.04),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Drink Image
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    color: Colors.transparent,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Image.asset(
                                    'assets/images/drinks/MONT BROGA.png',
                                    fit: BoxFit.contain,
                                  ),
                                ),
                                const SizedBox(width: 16),

                                // Drink Details
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          const Text(
                                            'Mont Broga',
                                            style: TextStyle(
                                              fontFamily: 'Recoleta',
                                              fontSize: 18,
                                              fontWeight: FontWeight.bold,
                                              color: Colors.black87,
                                            ),
                                          ),
                                          RichText(
                                            text: TextSpan(
                                              children: [
                                                const TextSpan(
                                                  text: 'RM ',
                                                  style: TextStyle(
                                                    fontFamily: 'Afacad',
                                                    fontSize: 10,
                                                    color: Colors.black87,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                                TextSpan(
                                                  text: _basePrice.toStringAsFixed(2),
                                                  style: const TextStyle(
                                                    fontFamily: 'Afacad',
                                                    fontSize: 14,
                                                    color: Colors.black87,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        'Iced/Regular Sweet\nRemarks: None',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 13,
                                          color: Colors.black87,
                                          height: 1.3,
                                        ),
                                      ),
                                      const SizedBox(height: 12),

                                      // Quantity Selector
                                      Container(
                                        width: 80,
                                        height: 28,
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(14),
                                          border: Border.all(
                                              color: orangeColor, width: 1),
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceEvenly,
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            GestureDetector(
                                              onTap: () {
                                                if (_quantity > 1) {
                                                  setState(() => _quantity--);
                                                } else if (_quantity == 1) {
                                                  Navigator.pop(
                                                      context); // "or delete" - pop back
                                                }
                                              },
                                              child: Text('-',
                                                  style: TextStyle(
                                                      color: orangeColor,
                                                      fontSize: 16,
                                                      fontWeight:
                                                          FontWeight.bold)),
                                            ),
                                            Text('$_quantity',
                                                style: TextStyle(
                                                    color: orangeColor,
                                                    fontSize: 14,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            GestureDetector(
                                              onTap: () {
                                                setState(() => _quantity++);
                                              },
                                              child: Text('+',
                                                  style: TextStyle(
                                                      color: orangeColor,
                                                      fontSize: 16,
                                                      fontWeight:
                                                          FontWeight.bold)),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Divider(color: AppColors.border, height: 1),
                            const SizedBox(height: 12),

                            // Total line
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: [
                                const Text(
                                  'Total : ',
                                  style: TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black87,
                                  ),
                                ),
                                RichText(
                                  text: TextSpan(
                                    children: [
                                      const TextSpan(
                                        text: 'RM ',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 10,
                                          color: Colors.black87,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      TextSpan(
                                        text: _totalPrice.toStringAsFixed(2),
                                        style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
                                          color: Colors.black87,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Add order text
                      Align(
                        alignment: Alignment.centerRight,
                        child: GestureDetector(
                          onTap: () => Navigator.pop(context),
                          child: Text(
                            '+ Add order',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: orangeColor,
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // Voucher Card
                      GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: _showVoucherSelectionModal,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                                color: orangeColor.withValues(alpha: 0.5),
                                width: 1),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Voucher',
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87,
                                    ),
                                  ),
                                  Text(
                                    _selectedVoucherTitle != null
                                        ? 'Change'
                                        : 'Select',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold,
                                      color: orangeColor,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Image.asset(
                                    'assets/images/voucher.png',
                                    width: 46,
                                    height: 46,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _selectedVoucherTitle ??
                                          'Select Voucher',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: _selectedVoucherTitle != null
                                            ? orangeColor
                                            : Colors.black87,
                                      ),
                                    ),
                                  ),
                                  if (_selectedVoucherTitle != null)
                                    Text(
                                      '-RM ${_voucherDiscount.toStringAsFixed(2)}',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: orangeColor,
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // Payment Method Card
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                              color: orangeColor.withValues(alpha: 0.5),
                              width: 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Payment Method',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                 Image.asset(
                                   'assets/images/wallet.png',
                                   width: 55,
                                   height: 55,
                                 ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Wallet',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 15,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87,
                                        ),
                                      ),
                                      Text(
                                        '0 tokens',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: orangeColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  width: 20,
                                  height: 20,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(
                                        color: orangeColor, width: 2),
                                  ),
                                  child: Center(
                                    child: Container(
                                      width: 10,
                                      height: 10,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: orangeColor,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Checkout Button
                      GestureDetector(
                        onTap: () {
                          globalOrderStatusVisible.value = true; // Show global banner
                          Navigator.pop(context, true); // Pop Checkout page — signals basket to clear
                        },
                        child: Container(
                          width: double.infinity,
                          height: 50,
                          decoration: BoxDecoration(
                            color: orangeColor,
                            borderRadius: BorderRadius.circular(25),
                          ),
                          child: const Center(
                            child: Text(
                              'CHECKOUT',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
