import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'orders_page.dart';
import 'profile_page.dart';
import 'loading_order_page.dart';
import 'referral_page.dart';
import 'dart:io';
import 'package:intl/intl.dart';
import '../widgets/order_status_banner.dart';
import 'my_rewards_page.dart';
import '../utils/app_colors.dart';

class RewardsPage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const RewardsPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

class _RewardsPageState extends State<RewardsPage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final Color orangeColor = AppColors.deepTeal;
  final Color beigeBg = Colors.white;
  int _selectedTier = 1; // Tier 2 index is 1
  bool _isFaqsOpen = false;

  void _onBottomNavTapped(int index) {
    if (index == 3) return;
    if (index == 0) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: HomePage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
        (route) => false,
      );
    } else if (index == 1) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => const InteractiveFillingLoader(
            targetPage: MenuPage(),
          ),
        ),
      );
    } else if (index == 2) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: OrdersPage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
      );
    } else if (index == 4) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: ProfilePage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: beigeBg,
      extendBody: true,
      onEndDrawerChanged: (isOpened) {
        setState(() {
          _isFaqsOpen = isOpened;
        });
      },
      endDrawer: _buildFaqsDrawer(),
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 3,
        onItemTapped: _onBottomNavTapped,
      ),
      body: Stack(
        children: [
          Column(
            children: [
              _buildHeader(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: 220),
                  child: Column(
                    children: [
                      const SizedBox(height: 16),
                      _buildPointsCard(),
                      const SizedBox(height: 16),
                      _buildActionCards(),
                      const SizedBox(height: 24),
                      _buildTierSection(),
                      const SizedBox(height: 24),
                      _buildFaqsCard(),
                    ],
                  ),
                ),
              ),
            ],
          ),
          OrderStatusBanner(
              bottomOffset: 90 + MediaQuery.paddingOf(context).bottom),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 50, bottom: 12, left: 20, right: 20),
      decoration: const BoxDecoration(
        color: Color(0xFF2E5E58),
        borderRadius: BorderRadius.only(
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
              onTap: () {
                Navigator.pushAndRemoveUntil(
                  context,
                  MaterialPageRoute(
                    builder: (context) => InteractiveFillingLoader(
                      targetPage: HomePage(
                        initialPickedImage: widget.initialPickedImage,
                        initialPresetPath: widget.initialPresetPath,
                        initialAvatarIndex: widget.initialAvatarIndex,
                      ),
                    ),
                  ),
                  (route) => false,
                );
              },
              child: const Icon(Icons.arrow_back_ios,
                  color: Colors.white, size: 20),
            ),
          ),
          Column(
            children: [
              const Text(
                'C2 COFFEE SQUAD',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'member since ${DateFormat('d MMMM yyyy').format(DateTime.now())}',
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 12,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPointsCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(16),
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
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Card image
              Expanded(
                flex: 5,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'assets/images/card.png',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Points status
              Expanded(
                flex: 4,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: const [
                      Text(
                        'you have',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black54,
                        ),
                      ),
                      Text(
                        '0 tokens',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: AppColors.softGold,
                          height: 1.1,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '0/1',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal,
                          height: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            "*Promo or free drinks don't earn cups and don't count toward rewards or tier upgrades.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 10,
              color: Colors.black54,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionCards() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const InteractiveFillingLoader(
                      targetPage: MyRewardsPage(),
                    ),
                  ),
                );
              },
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF4F3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFCFDEDB),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    Positioned(
                      top: 12,
                      bottom: 40,
                      left: 12,
                      right: 12,
                      child: Image.asset(
                        'assets/images/Surprise reward gift box with star popping out.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const Positioned(
                      bottom: 12,
                      left: 0,
                      right: 0,
                      child: Text(
                        'My Rewards',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF2E5E58),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const InteractiveFillingLoader(
                      targetPage: ReferralPage(),
                    ),
                  ),
                );
              },
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF4F3),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFCFDEDB),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.03),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    Positioned(
                      top: 12,
                      bottom: 40,
                      left: 12,
                      right: 12,
                      child: Image.asset(
                        'assets/images/Community friends laughing together waving hands and giving thumbs.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const Positioned(
                      bottom: 12,
                      left: 0,
                      right: 0,
                      child: Text(
                        'Refer a Friend',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF2E5E58),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTierSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              const Text(
                'Tier',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF2E5E58),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Container(
                  height: 1,
                  color: const Color(0xFFCFDEDB),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Tab Headers
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(
            children: [
              Expanded(child: _buildTierTab(0, 'Tier 1', 'Kawan', false)),
              Expanded(child: _buildTierTab(1, 'Tier 2', 'Dilamun', false)),
              Expanded(child: _buildTierTab(2, 'Tier 3', 'Ketagih', true)),
              Expanded(child: _buildTierTab(3, 'Tier 4', 'Legend', true)),
            ],
          ),
        ),
        // Tab Content
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(
              color: const Color(0xFFCFDEDB),
              width: 1,
            ),
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: SizedBox(
            height:
                150, // Fixed height to prevent layout jumps during transition
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: _selectedTier == 0
                  ? Container(
                      key: const ValueKey('tier0'),
                      width: double.infinity,
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: const Text(
                        'Just 1 cup to level up & unlock more member benefits.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 16,
                          color: Colors.black87,
                        ),
                      ),
                    )
                  : Column(
                      key: const ValueKey('other_tiers'),
                      children: [
                        _buildRewardListItem('1 Free Birthday Drink',
                            'added on your birthday and usable once'),
                        const Divider(),
                        _buildRewardListItem('Exclusive Promos',
                            'receive exclusive promotional offers'),
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTierTab(int index, String title, String subtitle, bool locked) {
    bool isSelected = index == _selectedTier;
    Color bgColor = locked
        ? const Color(0xFFEDF4F3)
        : (isSelected ? const Color(0xFFEDF4F3) : Colors.white);
    Color textColor = locked
        ? Colors.grey.shade400
        : (isSelected ? orangeColor : Colors.black87);

    return GestureDetector(
      onTap: () {
        if (!locked) {
          setState(() {
            _selectedTier = index;
          });
        }
      },
      child: Container(
        margin: const EdgeInsets.only(right: 1),
        padding: const EdgeInsets.symmetric(horizontal: 1, vertical: 12),
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(
            color:
                isSelected ? const Color(0xFFCFDEDB) : const Color(0xFFEDF4F3),
            width: 1,
          ),
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (locked) Icon(Icons.lock, size: 12, color: textColor),
            if (locked) const SizedBox(width: 2),
            Flexible(
              child: Column(
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 10,
                      color: textColor,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 9, // Reduced so C2 Reserve fits
                      fontWeight: FontWeight.bold,
                      color: textColor,
                    ),
                  ),
                ],
              ),
            ),
            if (locked)
              const SizedBox(
                  width: 14), // Balance the icon to keep text exactly centered
          ],
        ),
      ),
    );
  }

  Widget _buildRewardListItem(String title, String subtitle) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Color(0xFFEDF4F3),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.coffee, color: orangeColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E5E58),
                  ),
                ),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFaqsCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GestureDetector(
        onTap: () {
          _scaffoldKey.currentState?.openEndDrawer();
        },
        child: Container(
          padding: const EdgeInsets.all(16),
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
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: Color(0xFFEDF4F3),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.help_outline, color: orangeColor, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'FAQS',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2E5E58),
                      ),
                    ),
                    Text(
                      'Learn how it works',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF4F3),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: const Color(0xFFCFDEDB),
                    width: 1,
                  ),
                ),
                child: AnimatedRotation(
                  turns: _isFaqsOpen ? 0.25 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: const Icon(Icons.chevron_right,
                      color: Color(0xFF2E5E58), size: 20),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFaqsDrawer() {
    return Drawer(
      backgroundColor: Colors.white,
      width: MediaQuery.of(context).size.width * 0.85,
      child: Column(
        children: [
          // Header
          Padding(
            padding:
                const EdgeInsets.only(top: 60, left: 20, right: 20, bottom: 20),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: orangeColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.help_outline, color: orangeColor, size: 24),
                ),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'FAQS',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF2E5E58),
                      ),
                    ),
                    Text(
                      'Learn how it works',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Colors.grey,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          // Questions
          Expanded(
            child: ListView(
              padding: const EdgeInsets.only(bottom: 60),
              children: [
                _buildExpansionTile(
                  'How do I place an order?',
                  'Browse the menu, select your preferred drink, customize it to your liking, and tap Add to Cart. Proceed to checkout, choose your payment method, and confirm your order.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'What is Barista Craft?',
                  'Barista Craft is our signature service where you can choose specific barista-level customizations for your handcrafted beverage.',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'How do I earn reward points?',
                  'You earn 1 cup for every handcrafted beverage purchased. Collect enough cups to level up your tier and unlock exclusive benefits!',
                ),
                const Divider(height: 1),
                _buildExpansionTile(
                  'Can I cancel my order?',
                  'Orders can be cancelled through the app within 2 minutes of placing them. After the barista begins brewing, cancellation is no longer possible.',
                ),
                const Divider(height: 1),
              ],
            ),
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildExpansionTile(String title, String content) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        title: Text(
          title,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        iconColor: Colors.black87,
        collapsedIconColor: Colors.black87,
        childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
        expandedAlignment: Alignment.centerLeft,
        children: [
          Text(
            content,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 12,
              color: Colors.black54,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
