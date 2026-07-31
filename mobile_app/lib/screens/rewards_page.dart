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
import 'privacy_policy_page.dart';
import 'terms_of_use_page.dart';
import 'about_us_page.dart';
import 'my_rewards_page.dart';

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
  final Color orangeColor = const Color(0xFFE66B00);
  final Color beigeBg = const Color(0xFFFAF4EE);
  int _selectedTier = 1; // Tier 2 index is 1
  bool _isFaqsOpen = false;
  bool _hasClaimedToday = false;

  void _onBottomNavTapped(int index) {
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
          SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 120),
            child: Column(
              children: [
                _buildHeader(),
                const SizedBox(height: 16),
                _buildCheckInSection(),
                const SizedBox(height: 16),
                _buildActionCards(),
                const SizedBox(height: 24),
                _buildTierSection(),
                const SizedBox(height: 24),
                _buildFaqsCard(),
              ],
            ),
          ),
          const OrderStatusBanner(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.only(top: 60, bottom: 30, left: 20, right: 20),
      decoration: BoxDecoration(
        color: orangeColor,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(30),
          bottomRight: Radius.circular(30),
        ),
      ),
      child: Column(
        children: [
          Stack(
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
                      color: Colors.white, size: 24),
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
                    ),
                  ),
                  const SizedBox(height: 4),
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
          const SizedBox(height: 30),
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
                  padding: const EdgeInsets.only(
                      bottom: 30), // Shifting text upwards
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: const [
                      Text(
                        'you have',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '0 pts',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
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
                          color: Colors.white,
                          height: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            "*Promo or free drinks don't earn cups and don't count toward rewards or tier upgrades.",
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 10,
              color: Colors.white70,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckInSection() {
    return Column(
      children: [
        const Text(
          'Check-In for Rewards',
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Color(0xFF6B3A1A),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: List.generate(7, (index) {
            bool isToday = index == 0;
            return Column(
              children: [
                isToday
                    ? Image.asset(
                        'assets/images/coin.png',
                        width: 44,
                        height: 44,
                      )
                    : Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade300,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.lock,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                const SizedBox(height: 8),
                Text(
                  isToday ? 'TODAY' : 'DAY ${index + 1}',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isToday ? orangeColor : Colors.grey.shade400,
                  ),
                ),
              ],
            );
          }),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: 240,
          child: ElevatedButton(
            onPressed: _hasClaimedToday
                ? null
                : () {
                    setState(() {
                      _hasClaimedToday = true;
                    });
                  },
            style: ElevatedButton.styleFrom(
              backgroundColor: orangeColor,
              disabledBackgroundColor: Colors.grey.shade400,
              disabledForegroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            child: Text(
              _hasClaimedToday ? 'COME BACK TOMORROW' : 'CLAIM',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
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
                  color: orangeColor,
                  borderRadius: BorderRadius.circular(16),
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
                          color: Colors.white,
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
                  color: orangeColor,
                  borderRadius: BorderRadius.circular(16),
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
                          color: Colors.white,
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
                  color: Color(0xFF6B3A1A),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Container(
                  height: 1,
                  color: orangeColor.withValues(alpha: 0.5),
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
              Expanded(child: _buildTierTab(0, 'Tier 1', 'C2 Core', false)),
              Expanded(child: _buildTierTab(1, 'Tier 2', 'C2 Plus', false)),
              Expanded(child: _buildTierTab(2, 'Tier 3', 'C2 Prime', true)),
              Expanded(child: _buildTierTab(3, 'Tier 4', 'C2 Elite', true)),
            ],
          ),
        ),
        // Tab Content
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 20),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(16),
              bottomRight: Radius.circular(16),
              topRight: Radius.circular(16),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 5),
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
        ? Colors.grey.shade300
        : (isSelected ? orangeColor : orangeColor.withValues(alpha: 0.5));
    Color textColor = locked ? Colors.grey.shade600 : Colors.white;

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
            decoration: BoxDecoration(
              color: orangeColor.withValues(alpha: 0.1),
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
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
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
                        color: Color(0xFF6B3A1A),
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
                  color: orangeColor,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: AnimatedRotation(
                  turns: _isFaqsOpen ? 0.25 : 0,
                  duration: const Duration(milliseconds: 300),
                  child: const Icon(Icons.chevron_right,
                      color: Colors.white, size: 20),
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
                  child: Icon(Icons.help_outline,
                      color: orangeColor, size: 24),
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
                        color: Color(0xFF6B3A1A),
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
              padding: EdgeInsets.zero,
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

  Route _slideRightRoute(Widget page) {
    return PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => page,
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        const begin = Offset(1.0, 0.0);
        const end = Offset.zero;
        const curve = Curves.easeOutQuart;
        var tween =
            Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
        var offsetAnimation = animation.drive(tween);
        return SlideTransition(position: offsetAnimation, child: child);
      },
      transitionDuration: const Duration(milliseconds: 300),
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

  Widget _buildFooterLink(String title, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black54,
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.black54, size: 20),
          ],
        ),
      ),
    );
  }
}
