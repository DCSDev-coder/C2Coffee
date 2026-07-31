import 'package:flutter/material.dart';

class MyRewardsPage extends StatefulWidget {
  const MyRewardsPage({super.key});

  @override
  State<MyRewardsPage> createState() => _MyRewardsPageState();
}

class _MyRewardsPageState extends State<MyRewardsPage> {
  final Color orangeColor = const Color(0xFFE66B00);
  final Color beigeBg = const Color(0xFFF7F5F2);

  // 0 for "MY REWARDS", 1 for "BROWSE MORE"
  int _selectedTab = 0;
  
  // 0 for "Active", 1 for "Past"
  int _selectedSubTab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: beigeBg,
      appBar: AppBar(
        backgroundColor: orangeColor,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'MY REWARDS',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.info, color: Colors.white),
            onPressed: _showPointsRules,
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Top Section (Points and Toggles)
            Container(
              color: beigeBg,
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // Points Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: orangeColor, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 4,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Reward point',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 16,
                            color: Colors.black87,
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
                                color: Colors.black,
                                height: 1.0,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  
                  // Toggle Buttons
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedTab = 0),
                          child: Container(
                            height: 60,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _selectedTab == 0 ? orangeColor : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 4,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Text(
                              'MY\nREWARDS',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                height: 1.0,
                                color: _selectedTab == 0 ? Colors.white : orangeColor,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selectedTab = 1),
                          child: Container(
                            height: 60,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _selectedTab == 1 ? orangeColor : Colors.white,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 4,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Text(
                              'BROWSE\nMORE',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                height: 1.0,
                                color: _selectedTab == 1 ? Colors.white : orangeColor,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            const Divider(height: 1, color: Colors.white, thickness: 2),
            
            // Content Area
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              child: _selectedTab == 0 ? _buildMyRewardsView() : _buildBrowseMoreView(),
            ),
          ],
        ),
      ),
    );
  }

  void _showPointsRules() {
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
                  'C2 Points Rules',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: const Icon(Icons.close, size: 24, color: Colors.black54),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _buildRuleItem('spent RM 1 = 1 points'),
            const SizedBox(height: 16),
            _buildRuleItem('Make at least ONE (1) point-earning order to extend your points validity by one year.'),
            const SizedBox(height: 16),
            _buildRuleItem('Daily check-ins and any non-order point accruals do not extend validity.'),
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

  Widget _buildMyRewardsView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Secret Code Input
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Input secret code here',
                      hintStyle: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.grey,
                      ),
                      border: InputBorder.none,
                    ),
                  ),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (BuildContext context) {
                      return Dialog(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                        backgroundColor: Colors.white,
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Image.asset(
                                'assets/images/Surprise reward gift box with star popping out.png',
                                height: 100,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'Success!',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 24,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFE66B00),
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Your voucher has been claimed successfully and is now in your active rewards.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 24),
                              SizedBox(
                                width: double.infinity,
                                child: ElevatedButton(
                                  onPressed: () => Navigator.of(context).pop(),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFFE66B00),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    padding: const EdgeInsets.symmetric(vertical: 16),
                                    elevation: 0,
                                  ),
                                  child: const Text(
                                    'AWESOME',
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: orangeColor,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                  elevation: 0,
                ),
                child: const Text(
                  'CLAIM',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 30),
        
        // Active/Past Tabs
        Row(
          children: [
            GestureDetector(
              onTap: () => setState(() => _selectedSubTab = 0),
              child: Column(
                children: [
                  Text(
                    'Active 🥳',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _selectedSubTab == 0 ? orangeColor : Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (_selectedSubTab == 0)
                    Container(
                      height: 2,
                      width: 40,
                      color: orangeColor,
                    ),
                ],
              ),
            ),
            const SizedBox(width: 24),
            GestureDetector(
              onTap: () => setState(() => _selectedSubTab = 1),
              child: Column(
                children: [
                  Text(
                    'Past 😓',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: _selectedSubTab == 1 ? orangeColor : Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (_selectedSubTab == 1)
                    Container(
                      height: 2,
                      width: 40,
                      color: orangeColor,
                    ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        
        // Tab Content
        _selectedSubTab == 0 ? _buildActiveRewards() : _buildPastRewards(),
      ],
    );
  }

  Widget _buildActiveRewards() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
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
                color: const Color(0xFFC04B14),
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
                    color: Colors.black87,
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

  Widget _buildBrowseMoreView() {
    return Row(
      children: [
        Expanded(
          child: _buildRewardCard('RM 1 OFF on All Drinks', 40),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: _buildRewardCard('RM 5 OFF on All Drinks', 10),
        ),
      ],
    );
  }

  Widget _buildRewardCard(String title, int pointsRequired) {
    return Container(
      height: 180,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
              height: 1.2,
            ),
          ),
          const Spacer(),
          Center(
            child: ClipPath(
              clipper: TicketClipper(),
              child: Container(
                width: 60,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFC04B14), // Darker orange/brown
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  '%',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'to be\nredeemed',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 8,
                  color: Colors.grey.shade500,
                  height: 1.1,
                ),
              ),
              Text(
                '$pointsRequired/100 points',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 8,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Container(
            height: 2,
            width: double.infinity,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(1),
            ),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: pointsRequired / 100,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.grey.shade600,
                  borderRadius: BorderRadius.circular(1),
                ),
              ),
            ),
          ),
        ],
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
