import 'package:flutter/material.dart';

class MyRewardsPage extends StatefulWidget {
  const MyRewardsPage({super.key});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage> {
  final Color orangeColor = const Color(0xFF2E5E58);
  final Color beigeBg = Colors.white;

  // 0 for "Active", 1 for "Past"
  int _selectedSubTab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: beigeBg,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.only(
                  top: 50, bottom: 12, left: 20, right: 20),
              decoration: const BoxDecoration(
                color: Color(0xFF2E5E58),
                borderRadius: BorderRadius.only(
                  bottomLeft: Radius.circular(20),
                  bottomRight: Radius.circular(20),
                ),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios,
                        color: Colors.white, size: 20),
                  ),
                  const Expanded(
                    child: Center(
                      child: Text(
                        'MY REWARDS',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: _showTokensRules,
                    child: const Icon(Icons.info_outline,
                        color: Colors.white, size: 22),
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
                          Border.all(color: const Color(0xFFCFDEDB), width: 1),
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
                        const Text(
                          'Reward tokens',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 16,
                            color: Color(0xFF2E5E58),
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
                            const Text(
                              '0',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 48,
                                fontWeight: FontWeight.normal,
                                color: Color(0xFF2E5E58),
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
                                ? orangeColor
                                : const Color(0xFFEDF4F3),
                            borderRadius: BorderRadius.circular(50),
                            border: Border.all(
                              color: _selectedSubTab == 0
                                  ? orangeColor
                                  : const Color(0xFFCFDEDB),
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
                                  : orangeColor,
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
                                ? orangeColor
                                : const Color(0xFFEDF4F3),
                            borderRadius: BorderRadius.circular(50),
                            border: Border.all(
                              color: _selectedSubTab == 1
                                  ? orangeColor
                                  : const Color(0xFFCFDEDB),
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
                                  : orangeColor,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const Divider(height: 1, color: Color(0xFFEDF4F3), thickness: 1),

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
    );
  }

  void _showTokensRules() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'C2 Tokens Rules',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child:
                      const Icon(Icons.close, size: 24, color: Colors.black54),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildRuleItem('spent RM 1 = 1 token'),
            const SizedBox(height: 16),
            _buildRuleItem(
                'Make at least ONE (1) token-earning order to extend your tokens validity by one year.'),
            const SizedBox(height: 16),
            _buildRuleItem(
                'Daily check-ins and any non-order token accruals do not extend validity.'),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildRuleItem(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontFamily: 'Afacad',
        fontSize: 14,
        color: Colors.black,
        height: 1.4,
        fontWeight: FontWeight.w500,
      ),
    );
  }

  Widget _buildActiveRewards() {
    return Container(
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
              width: 50,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: orangeColor,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                '%',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 24,
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
                const Text(
                  'Buy 1 Free 1',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E5E58),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Use by 11.10.2026   09:52',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
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
