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
import 'order_details_page.dart';
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

  Color get orangeColor => AppColors.deepTeal;
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
      InteractiveFillingLoader.show(
        context,
        targetPage: HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 1) {
      InteractiveFillingLoader.show(context, targetPage: const MenuPage());
    } else if (index == 2) {
      InteractiveFillingLoader.show(
        context,
        targetPage: OrdersPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      );
    } else if (index == 3) {
      InteractiveFillingLoader.show(
        context,
        targetPage: RewardsPage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
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
            AppColors.deepTeal, // Add the dark green background back
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
                              InteractiveFillingLoader.show(
                                context,
                                targetPage: SettingsPage(
                                  onProfileUpdated: _loadAvatarState,
                                  returnPage: const ProfilePage(),
                                ),
                              );
                            },
                            child: const Icon(Icons.settings_outlined,
                                color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 14),
                          GestureDetector(
                            onTap: () {
                              InteractiveFillingLoader.show(
                                context,
                                targetPage: const NotificationPage(),
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
                                    decoration: BoxDecoration(
                                      color: AppColors.accent,
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
                            color: AppColors.border,
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
                                    builder: (context) => SettingsPage(
                                      onProfileUpdated: _loadAvatarState,
                                      returnPage: const ProfilePage(),
                                    ),
                                  ),
                                );
                              },
                              child: _buildAvatar(),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                'Hey $_username,',
                                style: TextStyle(
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
                                color: AppColors.border,
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
                                  InteractiveFillingLoader.show(
                                    context,
                                    targetPage: const TopUpWalletPage(),
                                  );
                                },
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 16),
                                  child: Row(
                                    children: [
                                      Image.asset('assets/images/wallet.png',
                                          height: 80),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          'Wallet',
                                          style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.deepTeal,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      GestureDetector(
                                        onTap: () {
                                          InteractiveFillingLoader.show(
                                            context,
                                            targetPage: const TopUpWalletPage(),
                                          );
                                        },
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 12, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceLight,
                                            borderRadius:
                                                BorderRadius.circular(20),
                                            border: Border.all(
                                              color: AppColors.border,
                                              width: 1,
                                            ),
                                          ),
                                          child: Text('Top up \u2192',
                                              style: TextStyle(
                                                  fontFamily: 'Afacad',
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.deepTeal)),
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
                                      color: AppColors.border,
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
                                        InteractiveFillingLoader.show(
                                          context,
                                          targetPage: const MyRewardsPage(),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 20, horizontal: 16),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            Text('My Reward',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: AppColors.deepTeal)),
                                            const SizedBox(height: 16),
                                            Image.asset(
                                                'assets/images/Surprise reward gift box with star popping out.png',
                                                height: 95),
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
                                      color: AppColors.border,
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
                                        InteractiveFillingLoader.show(
                                          context,
                                          targetPage: const ReferralPage(),
                                        );
                                      },
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 20, horizontal: 16),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.center,
                                          children: [
                                            Text('My Referrals',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    fontFamily: 'Recoleta',
                                                    fontSize: 18,
                                                    fontWeight: FontWeight.bold,
                                                    color: AppColors.deepTeal)),
                                            const SizedBox(height: 16),
                                            Image.asset(
                                                'assets/images/Community friends laughing together waving hands and giving thumbs.png',
                                                height: 95),
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
                      Text('News',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal)),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
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
                                  Text('C2 Barista Craft',
                                      style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.deepTeal)),
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
                            color: AppColors.border,
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
                                  Text('Skip the Queue',
                                      style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.deepTeal)),
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
                      Text('Calendar',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal)),
                      const SizedBox(height: 12),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0),
                        child: CustomCalendarWidget(),
                      ),
                      const SizedBox(height: 24),

                      // Our Promise Section
                      Text('Our Promise',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: AppColors.deepTeal)),
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
          color: AppColors.border,
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
                      Icon(Icons.chevron_left, color: AppColors.deepTeal),
                  onPressed: _previousMonth),
              Text(
                '${monthNames[_currentMonth.month - 1]} ${_currentMonth.year}',
                style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal),
              ),
              IconButton(
                  icon:
                      Icon(Icons.chevron_right, color: AppColors.deepTeal),
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

              return GestureDetector(
                onTap: isBought
                    ? () {
                        final String formattedDate =
                            "${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}";

                        final pastOrderItem = {
                          'id': '${date.millisecondsSinceEpoch}',
                          'date': formattedDate,
                          'time': '10:30 am',
                          'name': 'Mont Broga',
                          'details':
                              'Dato Blend / Hot / Fresh Milk /\nReg. Sweet / Reg. Ice /\nTake Away',
                          'remarks': 'None',
                          'quantity': 1,
                          'image': 'assets/images/drinks/SHAKERATO BIANCO.png',
                        };

                        InteractiveFillingLoader.show(
                          context,
                          targetPage: OrderDetailsPage(item: pastOrderItem),
                        );
                      }
                    : null,
                child: Container(
                  margin: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.transparent,
                    border: isBought
                        ? Border.all(color: AppColors.deepTeal, width: 1.5)
                        : null,
                  ),
                  child: Center(
                    child: Text(
                      day.toString(),
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color:
                            isBought ? AppColors.deepTeal : Colors.black87,
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
              color: AppColors.border,
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
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 22, // increased from 16
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
          ),
        );
      },
    );
  }
}
