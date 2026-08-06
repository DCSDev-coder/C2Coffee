import 'dart:io';
import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import '../services/user_service.dart';
import 'home_page.dart';
import 'menu_page.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';
import 'top_up_wallet_page.dart';
import 'notification_page.dart';
import 'settings_page.dart';
import 'rewards_page.dart';
import 'my_rewards_page.dart';
import 'referral_page.dart';
import '../widgets/order_status_banner.dart';
import '../utils/app_colors.dart';

class ProfilePage extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const ProfilePage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  File? _persistedPickedImage;
  String? _persistedPresetPath;
  String _username = 'Guest';

  final Color orangeColor = const Color(0xFF2E5E58);
  final Color bgColor = Colors.white;

  @override
  void initState() {
    super.initState();
    _loadAvatarState();
  }

  Future<void> _loadAvatarState() async {
    final avatarData = await UserService.getAvatar();
    final profileData = await UserService.getUserProfile();
    setState(() {
      if (avatarData['pickedImagePath'] != null) {
        _persistedPickedImage = File(avatarData['pickedImagePath']!);
      } else {
        _persistedPickedImage = null;
      }
      _persistedPresetPath = avatarData['presetPath'];

      if (profileData['username'] != null &&
          profileData['username']!.isNotEmpty) {
        _username = profileData['username']!;
      }
    });
  }

  void _onBottomNavTapped(int index) {
    if (index == 4) return;
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
    } else if (index == 3) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => InteractiveFillingLoader(
            targetPage: RewardsPage(
              initialPickedImage: widget.initialPickedImage,
              initialPresetPath: widget.initialPresetPath,
              initialAvatarIndex: widget.initialAvatarIndex,
            ),
          ),
        ),
      );
    }
  }

  Widget _buildAvatar() {
    if (_persistedPickedImage != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: kIsWeb
            ? NetworkImage(_persistedPickedImage!.path)
            : FileImage(_persistedPickedImage!) as ImageProvider,
        backgroundColor: Colors.transparent,
      );
    } else if (_persistedPresetPath != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: AssetImage(_persistedPresetPath!),
        backgroundColor:
            const Color(0xFF2E5E58), // Add the dark green background back
      );
    } else {
      return CircleAvatar(
        radius: 28,
        backgroundColor: orangeColor,
        child: const Icon(Icons.person, size: 36, color: Colors.white),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bgColor,
      extendBody: true,
      bottomNavigationBar: CustomBottomNav(
        selectedIndex: 4,
        onItemTapped: _onBottomNavTapped,
      ),
      body: Stack(
        children: [
          Column(
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
                    const Text(
                      'PROFILE',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      InteractiveFillingLoader(
                                    targetPage: SettingsPage(
                                      onProfileUpdated: _loadAvatarState,
                                      returnPage: const ProfilePage(),
                                    ),
                                  ),
                                ),
                              );
                            },
                            child: const Icon(Icons.settings_outlined,
                                color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 14),
                          GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      const InteractiveFillingLoader(
                                    targetPage: NotificationPage(),
                                  ),
                                ),
                              );
                            },
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                const Icon(Icons.notifications_outlined,
                                    color: Colors.white, size: 26),
                                Positioned(
                                  top: 1,
                                  right: 1,
                                  child: Container(
                                    width: 8,
                                    height: 8,
                                    decoration: const BoxDecoration(
                                      color: AppColors.terracotta,
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(
                      left: 16, right: 16, top: 20, bottom: 130),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Profile Card
                      Container(
                        padding: const EdgeInsets.all(16),
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
                              offset: const Offset(0, 2),
                            )
                          ],
                        ),
                        child: Row(
                          children: [
                            GestureDetector(
                              onTap: () async {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                      builder: (context) =>
                                          InteractiveFillingLoader(
                                              targetPage: SettingsPage(
                                            onProfileUpdated: _loadAvatarState,
                                            returnPage: const ProfilePage(),
                                          ))),
                                );
                              },
                              child: _buildAvatar(),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                'Hey $_username,',
                                style: const TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.deepTeal,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Dashboard Grid
                      Column(
                        children: [
                          // Wallet Box
                          Container(
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
                            child: Material(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(20),
                              child: InkWell(
                                borderRadius: BorderRadius.circular(20),
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) =>
                                          const InteractiveFillingLoader(
                                        targetPage: TopUpWalletPage(),
                                      ),
                                    ),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 20),
                                  child: Row(
                                    children: [
                                      Image.asset('assets/images/wallet.png',
                                          height: 60),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            const Text('Wallet Balance',
                                                style: TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF2E5E58))),
                                            const SizedBox(height: 4),
                                            Text('0 points',
                                                style: TextStyle(
                                                    fontFamily: 'Afacad',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: orangeColor)),
                                          ],
                                        ),
                                      ),
                                      GestureDetector(
                                        onTap: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder: (context) =>
                                                  const InteractiveFillingLoader(
                                                targetPage: TopUpWalletPage(),
                                              ),
                                            ),
                                          );
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 16, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEDF4F3),
                                            borderRadius:
                                                BorderRadius.circular(20),
                                            border: Border.all(
                                              color: const Color(0xFFCFDEDB),
                                              width: 1,
                                            ),
                                          ),
                                          child: const Text('Top up \u2192',
                                              style: TextStyle(
                                                  fontFamily: 'Afacad',
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF2E5E58))),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Rewards & Referrals
                          Row(
                            children: [
                              // My Reward
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: const Color(0xFFCFDEDB),
                                      width: 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                          color: Colors.black
                                              .withValues(alpha: 0.03),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2))
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(20),
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) =>
                                                const InteractiveFillingLoader(
                                              targetPage: MyRewardsPage(),
                                            ),
                                          ),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 20, horizontal: 16),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            const Text('My Reward',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF2E5E58))),
                                            const SizedBox(height: 16),
                                            Image.asset(
                                                'assets/images/Surprise reward gift box with star popping out.png',
                                                height: 70),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                              // My Referrals
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: const Color(0xFFCFDEDB),
                                      width: 1,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                          color: Colors.black
                                              .withValues(alpha: 0.03),
                                          blurRadius: 8,
                                          offset: const Offset(0, 2))
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(20),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(20),
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          MaterialPageRoute(
                                            builder: (context) =>
                                                const InteractiveFillingLoader(
                                              targetPage: ReferralPage(),
                                            ),
                                          ),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 20, horizontal: 16),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            const Text('My Referrals',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: Color(0xFF2E5E58))),
                                            const SizedBox(height: 16),
                                            Image.asset(
                                                'assets/images/Community friends laughing together waving hands and giving thumbs.png',
                                                height: 70),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // News Section
                      const Text('News',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E5E58))),
                      const SizedBox(height: 12),
                      Container(
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
                                offset: const Offset(0, 2))
                          ],
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.asset(
                                  'assets/images/barista_craft_banner.png',
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('C2 Barista Craft',
                                      style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF2E5E58))),
                                  const SizedBox(height: 6),
                                  Text(
                                      'Discover our new handcrafted joy and playful sips.',
                                      style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
                                          color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                      Container(
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
                                offset: const Offset(0, 2))
                          ],
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.asset(
                                  'assets/images/promo_banner_2.png',
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Skip the Queue',
                                      style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFF2E5E58))),
                                  const SizedBox(height: 6),
                                  Text(
                                      'Order ahead with mobile ordering and save time.',
                                      style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
                                          color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Calendar Section
                      const Text('Calendar',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E5E58))),
                      const SizedBox(height: 12),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0),
                        child: CustomCalendarWidget(),
                      ),
                      const SizedBox(height: 24),

                      // Our Promise Section
                      const Text('Our Promise',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2E5E58))),
                      const SizedBox(height: 12),
                      const SizedBox(
                        height: 140, // Increased from 100
                        child: OurPromiseCarousel(),
                      ),
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
}

class CustomCalendarWidget extends StatefulWidget {
  const CustomCalendarWidget({super.key});

  @override
  State<CustomCalendarWidget> createState() => _CustomCalendarWidgetState();
}

class _CustomCalendarWidgetState extends State<CustomCalendarWidget> {
  DateTime _currentMonth = DateTime.now();
  DateTime? _selectedDate;

  // Dummy dates to indicate drink bought
  final List<DateTime> _drinkBoughtDates = [
    DateTime(DateTime.now().year, DateTime.now().month, 4),
    DateTime(DateTime.now().year, DateTime.now().month, 10),
    DateTime(DateTime.now().year, DateTime.now().month, 18),
    DateTime(DateTime.now().year, DateTime.now().month, 26),
    DateTime(DateTime.now().year, DateTime.now().month, 31),
  ];

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
  }

  bool _isDrinkBought(DateTime date) {
    return _drinkBoughtDates.any((d) =>
        d.year == date.year && d.month == date.month && d.day == date.day);
  }

  @override
  Widget build(BuildContext context) {
    final int daysInMonth =
        DateUtils.getDaysInMonth(_currentMonth.year, _currentMonth.month);
    final int firstWeekday =
        DateTime(_currentMonth.year, _currentMonth.month, 1).weekday;

    // adjust for Monday=1, Sunday=7 in dart.
    // We want Monday to be the first column (index 0)
    final int emptySlots = firstWeekday - 1;

    final List<String> monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ];
    final List<String> dayNames = [
      "MON",
      "TUE",
      "WED",
      "THU",
      "FRI",
      "SAT",
      "SUN"
    ];

    return Container(
      padding: const EdgeInsets.all(16),
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
      child: Column(
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                  icon:
                      const Icon(Icons.chevron_left, color: Color(0xFF2E5E58)),
                  onPressed: _previousMonth),
              Text(
                '${monthNames[_currentMonth.month - 1]} ${_currentMonth.year}',
                style: const TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E5E58)),
              ),
              IconButton(
                  icon:
                      const Icon(Icons.chevron_right, color: Color(0xFF2E5E58)),
                  onPressed: _nextMonth),
            ],
          ),
          const SizedBox(height: 16),
          // Days of week
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: dayNames
                .map((day) => SizedBox(
                      width: 30,
                      child: Center(
                          child: Text(day,
                              style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.grey))),
                    ))
                .toList(),
          ),
          const SizedBox(height: 12),
          // Grid
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: daysInMonth + emptySlots,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              childAspectRatio: 1.0,
            ),
            itemBuilder: (context, index) {
              if (index < emptySlots) return const SizedBox();

              final int day = index - emptySlots + 1;
              final DateTime date =
                  DateTime(_currentMonth.year, _currentMonth.month, day);
              final bool isBought = _isDrinkBought(date);
              final bool isSelected = _selectedDate?.year == date.year &&
                  _selectedDate?.month == date.month &&
                  _selectedDate?.day == date.day;

              return GestureDetector(
                onTap: () {
                  setState(() => _selectedDate = date);
                },
                child: Container(
                  margin: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected
                        ? const Color(0xFF2E5E58)
                        : Colors.transparent,
                    border: isBought && !isSelected
                        ? Border.all(color: const Color(0xFF2E5E58), width: 1.5)
                        : null,
                  ),
                  child: Center(
                    child: Text(
                      day.toString(),
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: isSelected ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class OurPromiseCarousel extends StatefulWidget {
  const OurPromiseCarousel({super.key});

  @override
  State<OurPromiseCarousel> createState() => _OurPromiseCarouselState();
}

class _OurPromiseCarouselState extends State<OurPromiseCarousel> {
  final PageController _pageController =
      PageController(initialPage: 1, viewportFraction: 0.85);

  final List<String> _promises = [
    '100% certified muslim-made',
    'made with love',
    'playful sips, handcrafted joy',
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      controller: _pageController,
      itemCount: _promises.length,
      itemBuilder: (context, index) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          padding: const EdgeInsets.all(12),
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
                  blurRadius: 6,
                  offset: const Offset(0, 2))
            ],
          ),
          child: Center(
            child: Text(
              _promises[index],
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 22, // increased from 16
                fontWeight: FontWeight.bold,
                color: Color(0xFF2E5E58),
              ),
            ),
          ),
        );
      },
    );
  }
}
