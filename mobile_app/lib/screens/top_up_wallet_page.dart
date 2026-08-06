import 'package:flutter/material.dart';
import 'loading_order_page.dart';

class TopUpWalletPage extends StatefulWidget {
  const TopUpWalletPage({super.key});

  @override
  State<TopUpWalletPage> createState() => _TopUpWalletPageState();
}

class _TopUpWalletPageState extends State<TopUpWalletPage> {
  int? _selectedAmount; // index of selected preset amount

  final List<int> _presetAmounts = [20, 50, 100];

  @override
  Widget build(BuildContext context) {
    const Color brandColor = Color(0xFF2E5E58);
    const Color bgColor = Colors.white;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
              builder: (context) => const InteractiveFillingLoader()),
        );
      },
      child: Scaffold(
        backgroundColor: bgColor,
        body: SingleChildScrollView(
          child: Column(
            children: [
              // App Bar
              Container(
                padding: const EdgeInsets.only(
                    top: 50, bottom: 12, left: 20, right: 20),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    bottom: BorderSide(color: Color(0xFFEDF4F3), width: 1),
                  ),
                ),
                child: Row(
                  children: [
                    GestureDetector(
                      onTap: () {
                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (context) =>
                                const InteractiveFillingLoader(),
                          ),
                        );
                      },
                      child: const Icon(Icons.arrow_back_ios,
                          color: brandColor, size: 20),
                    ),
                    const Expanded(
                      child: Center(
                        child: Text(
                          'TOP UP WALLET',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: brandColor,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 20),
                  ],
                ),
              ),

              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Balance Card
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFFCFDEDB),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2))
                        ],
                      ),
                      child: Row(
                        children: [
                          Image.asset('assets/images/wallet.png', height: 48),
                          const SizedBox(width: 16),
                          const Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Balance',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                              SizedBox(height: 2),
                              Text(
                                '0 points',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Select Amount
                    const Text(
                      'Select amount',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: List.generate(_presetAmounts.length, (i) {
                        final amount = _presetAmounts[i];
                        final selected = _selectedAmount == i;
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedAmount = i),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              margin: EdgeInsets.only(
                                  right:
                                      i < _presetAmounts.length - 1 ? 12 : 0),
                              padding: const EdgeInsets.symmetric(vertical: 18),
                              decoration: BoxDecoration(
                                color: selected
                                    ? brandColor
                                    : const Color(0xFFEDF4F3),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: selected
                                      ? brandColor
                                      : const Color(0xFFCFDEDB),
                                  width: 1.5,
                                ),
                                boxShadow: selected
                                    ? [
                                        BoxShadow(
                                          color: brandColor.withValues(
                                              alpha: 0.18),
                                          blurRadius: 10,
                                          offset: const Offset(0, 4),
                                        )
                                      ]
                                    : [],
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    'RM',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 12,
                                      color: selected
                                          ? Colors.white70
                                          : Colors.grey.shade500,
                                    ),
                                  ),
                                  Text(
                                    '$amount',
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                      color:
                                          selected ? Colors.white : brandColor,
                                      height: 1.1,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),

                    // All top-up methods
                    const Text(
                      'All top-up methods',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: const Color(0xFFCFDEDB),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2))
                        ],
                      ),
                      child: Row(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.asset(
                              "assets/images/Touch_'n_Go_eWallet_logo.svg.webp",
                              height: 44,
                              width: 44,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(width: 16),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Touch n go',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: brandColor,
                                  ),
                                ),
                                Text(
                                  '********1134',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Radio button
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: brandColor, width: 2),
                            ),
                            child: Center(
                              child: Container(
                                width: 16,
                                height: 16,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: brandColor,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Top Up button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _selectedAmount == null
                            ? null
                            : () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Top up RM${_presetAmounts[_selectedAmount!]} successful!',
                                      style:
                                          const TextStyle(fontFamily: 'Afacad'),
                                    ),
                                    backgroundColor: brandColor,
                                    behavior: SnackBarBehavior.floating,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                );
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: brandColor,
                          disabledBackgroundColor: const Color(0xFFCFDEDB),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          elevation: 0,
                        ),
                        child: Text(
                          _selectedAmount == null
                              ? 'SELECT AN AMOUNT'
                              : 'TOP UP RM${_presetAmounts[_selectedAmount!]}',
                          style: const TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Recent Transactions
                    const Text(
                      'Recent Transactions',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: const Color(0xFFCFDEDB),
                          width: 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2))
                        ],
                      ),
                      child: const Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Top Up',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: brandColor,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Via Touch n go',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 14,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                '+ RM20.00',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 24),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Order 1',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: brandColor,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    '14 July 2026',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 14,
                                      color: Colors.grey,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                '- RM16.90',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
