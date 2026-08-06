import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import '../widgets/order_status_banner.dart';
import '../utils/app_colors.dart';

class MyRewardsPage extends StatefulWidget {
  const MyRewardsPage({super.key});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage> {
  Color get orangeColor => AppColors.gold;
  final Color beigeBg = Colors.white;

  // 0 for "Active", 1 for "Past"
  int _selectedSubTab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: beigeBg,
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              children: [
                // Header
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
                        'MY REWARDS',
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

                // Top Section (Tokens Card)
                Container(
                  color: beigeBg,
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      // Tokens Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 24, vertical: 20),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border:
                              Border.all(color: AppColors.border, width: 1),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.03),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Reward tokens',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 16,
                                color: AppColors.deepTeal,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Row(
                              children: [
                                Image.asset(
                                  'assets/images/coin.png',
                                  width: 32,
                                  height: 32,
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '0',
                                  style: TextStyle(
                                    fontFamily: 'Recoleta',
                                    fontSize: 48,
                                    fontWeight: FontWeight.normal,
                                    color: AppColors.deepTeal,
                                    height: 1.0,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Active / Past pill buttons
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () => setState(() => _selectedSubTab = 0),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 28, vertical: 10),
                              decoration: BoxDecoration(
                                color: _selectedSubTab == 0
                                    ? AppColors.deepTeal
                                    : AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(50),
                                border: Border.all(
                                  color: _selectedSubTab == 0
                                      ? AppColors.deepTeal
                                      : AppColors.border,
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                'Active',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: _selectedSubTab == 0
                                      ? Colors.white
                                      : AppColors.deepTeal,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          GestureDetector(
                            onTap: () => setState(() => _selectedSubTab = 1),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 28, vertical: 10),
                              decoration: BoxDecoration(
                                color: _selectedSubTab == 1
                                    ? AppColors.deepTeal
                                    : AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(50),
                                border: Border.all(
                                  color: _selectedSubTab == 1
                                      ? AppColors.deepTeal
                                      : AppColors.border,
                                  width: 1,
                                ),
                              ),
                              child: Text(
                                'Past',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: _selectedSubTab == 1
                                      ? Colors.white
                                      : AppColors.deepTeal,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                Divider(height: 1, color: AppColors.border, thickness: 1),

                // Content Area
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  child: _selectedSubTab == 0
                      ? _buildActiveRewards()
                      : _buildPastRewards(),
                ),
              ],
            ),
          ),
          const OrderStatusBanner(),
        ],
      ),
    );
  }

  final List<Map<String, dynamic>> _activeVouchers = [
    {
      'title': 'Buy 1 Free 1 Any Coffee',
      'expiry': 'Use by 11.10.2026   09:52',
      'code': 'C2-B1F1-2026',
      'discount': '%',
      'terms': 'Valid for any handcrafted C2 coffee beverage. Redeemable once at checkout.',
    },
    {
      'title': 'RM 5 Off Handcrafted Drink',
      'expiry': 'Use by 15.11.2026   23:59',
      'code': 'C2-RM5-OFF',
      'discount': 'RM5',
      'terms': 'Applicable on any drink order above RM 12.00.',
    },
    {
      'title': '10% Off Merchandise',
      'expiry': 'Use by 31.12.2026   23:59',
      'code': 'C2-10OFF-M',
      'discount': '10%',
      'terms': 'Valid for C2 official tumblers, cups, and merchandise items.',
    },
  ];

  Widget _buildActiveRewards() {
    return Column(
      children: _activeVouchers.map((voucher) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: GestureDetector(
            onTap: () => _showVoucherDetailsModal(voucher),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.border,
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  ClipPath(
                    clipper: TicketClipper(),
                    child: Container(
                      width: 54,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: orangeColor,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        voucher['discount'] as String,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize:
                              (voucher['discount'] as String).length > 2
                                  ? 13
                                  : 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          voucher['title'] as String,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          voucher['expiry'] as String,
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.arrow_forward_ios,
                    size: 16,
                    color: AppColors.deepTeal,
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  void _showVoucherDetailsModal(Map<String, dynamic> voucher) {
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
            top: 24,
            left: 24,
            right: 24,
            bottom: 24 + MediaQuery.paddingOf(context).bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
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
              const SizedBox(height: 20),
              // Header title & badge
              Row(
                children: [
                  ClipPath(
                    clipper: TicketClipper(),
                    child: Container(
                      width: 50,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: orangeColor,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        voucher['discount'] as String,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize:
                              (voucher['discount'] as String).length > 2
                                  ? 13
                                  : 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          voucher['title'] as String,
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color:
                                AppColors.deepTeal.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Active Voucher',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.grey),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 16),
              // Validity & Terms
              Text(
                voucher['expiry'] as String,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                voucher['terms'] as String,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  color: Colors.black54,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPastRewards() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 60),
      alignment: Alignment.center,
      child: Text(
        'No used or expired reward found.',
        style: TextStyle(
          fontFamily: 'Afacad',
          fontSize: 14,
          color: Colors.grey.shade600,
        ),
      ),
    );
  }
}

class TicketClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    Path path = Path();
    double holeRadius = 6.0;

    path.moveTo(0, 0);
    path.lineTo(size.width, 0);
    path.lineTo(size.width, size.height / 2 - holeRadius);
    path.arcToPoint(
      Offset(size.width, size.height / 2 + holeRadius),
      radius: Radius.circular(holeRadius),
      clockwise: false,
    );
    path.lineTo(size.width, size.height);
    path.lineTo(0, size.height);
    path.lineTo(0, size.height / 2 + holeRadius);
    path.arcToPoint(
      Offset(0, size.height / 2 - holeRadius),
      radius: Radius.circular(holeRadius),
      clockwise: false,
    );
    path.close();

    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}
