import 'package:flutter/material.dart';

class OrderConfirmationPage extends StatefulWidget {
  const OrderConfirmationPage({super.key});

  @override
  State<OrderConfirmationPage> createState() => _OrderConfirmationPageState();
}

class _OrderConfirmationPageState extends State<OrderConfirmationPage> {
  int _quantity = 1;
  final double _basePrice = 16.90;

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFFE76D00);
    const Color bgColor = Color(0xFFF6F6F6);

    return Scaffold(
      backgroundColor: bgColor,
      body: Stack(
        children: [
          // Main Content Area
          Column(
            children: [
              // Custom Header
              Container(
                padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
                decoration: const BoxDecoration(
                  color: orangeColor,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 24),
                    ),
                    const Expanded(
                      child: Center(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            'ORDER CONFIRMATION',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 24), // Balance the flex for centering
                  ],
                ),
              ),

              // Scrollable Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Subtitle
                      const Text(
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
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                                            text: const TextSpan(
                                              children: [
                                                TextSpan(
                                                  text: 'RM ',
                                                  style: TextStyle(
                                                    fontFamily: 'Afacad',
                                                    fontSize: 10,
                                                    color: Colors.black87,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                                TextSpan(
                                                  text: '16.90',
                                                  style: TextStyle(
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
                                          borderRadius: BorderRadius.circular(14),
                                          border: Border.all(color: orangeColor, width: 1),
                                        ),
                                        child: Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                          crossAxisAlignment: CrossAxisAlignment.center,
                                          children: [
                                            GestureDetector(
                                              onTap: () {
                                                if (_quantity > 1) {
                                                  setState(() => _quantity--);
                                                } else if (_quantity == 1) {
                                                  Navigator.pop(context); // "or delete" - pop back
                                                }
                                              },
                                              child: const Text('-', style: TextStyle(color: orangeColor, fontSize: 16, fontWeight: FontWeight.bold)),
                                            ),
                                            Text('$_quantity', style: const TextStyle(color: orangeColor, fontSize: 14, fontWeight: FontWeight.bold)),
                                            GestureDetector(
                                              onTap: () {
                                                setState(() => _quantity++);
                                              },
                                              child: const Text('+', style: TextStyle(color: orangeColor, fontSize: 16, fontWeight: FontWeight.bold)),
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
                            const Divider(color: Color(0xFFEEEEEE), height: 1),
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
                                        text: (_basePrice * _quantity).toStringAsFixed(2),
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
                          child: const Text(
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: orangeColor.withValues(alpha: 0.5), width: 1),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
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
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFC85A17), // Darker orange/brown
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Text(
                                    '%',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Text(
                                  'Select Voucher',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      
                      const SizedBox(height: 16),
                      
                      // Payment Method Card
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: orangeColor.withValues(alpha: 0.5), width: 1),
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
                                const Icon(Icons.account_balance_wallet_outlined, size: 28, color: Colors.black87),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
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
                                        'RM0.00',
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
                                    border: Border.all(color: orangeColor, width: 2),
                                  ),
                                  child: Center(
                                    child: Container(
                                      width: 10,
                                      height: 10,
                                      decoration: const BoxDecoration(
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
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Order placed successfully!'),
                              backgroundColor: orangeColor,
                            ),
                          );
                          Navigator.pop(context, true);
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
