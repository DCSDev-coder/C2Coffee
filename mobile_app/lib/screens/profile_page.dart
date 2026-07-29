import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import '../widgets/custom_bottom_nav.dart';
import 'home_page.dart';
import 'loading_order_page.dart';
import 'orders_page.dart';

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
  final Color orangeColor = const Color(0xFFE66B00);
  final Color bgColor = const Color(0xFFFAF4EE);

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
    } else if (index == 2) {
      Navigator.push(
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
    } else if (index != 4) {
      Navigator.pop(context);
    }
  }

  Widget _buildAvatar() {
    if (widget.initialPickedImage != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: FileImage(widget.initialPickedImage!),
        backgroundColor: Colors.transparent,
      );
    } else if (widget.initialPresetPath != null) {
      return CircleAvatar(
        radius: 28,
        backgroundImage: AssetImage(widget.initialPresetPath!),
        backgroundColor: Colors.transparent,
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
      body: Stack(
        children: [
          Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
                decoration: BoxDecoration(
                  color: orangeColor,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    GestureDetector(
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
                      child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 24),
                    ),
                    const Text(
                      'PROFILE',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Row(
                      children: const [
                        Icon(Icons.settings_outlined, color: Colors.white, size: 26),
                        SizedBox(width: 16),
                        Icon(Icons.notifications, color: Colors.white, size: 26),
                      ],
                    ),
                  ],
                ),
              ),
              // Content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(left: 16, right: 16, top: 20, bottom: 130),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Profile Card
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 5),
                            )
                          ],
                        ),
                        child: Row(
                          children: [
                            _buildAvatar(),
                            const SizedBox(width: 16),
                            const Text(
                              'Hey Coffeelover1,',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Dashboard Grid
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Wallet
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Wallet', style: TextStyle(fontFamily: 'Recoleta', fontSize: 18, fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              Container(
                                width: 90,
                                height: 156,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                                ),
                                child: Material(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(20),
                                    onTap: () {}, // Add your navigation/action here
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        const Icon(Icons.account_balance_wallet_outlined, size: 40, color: Colors.black87),
                                        const SizedBox(height: 24),
                                        Text('RM0.00', style: TextStyle(fontFamily: 'Afacad', fontSize: 16, fontWeight: FontWeight.bold, color: orangeColor)),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 32),
                          // Rewards & Referrals
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('My Reward', style: TextStyle(fontFamily: 'Recoleta', fontSize: 18, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 8),
                                Container(
                                  height: 60,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                                  ),
                                  child: Material(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(16),
                                      onTap: () {}, // Add your navigation/action here
                                      child: const Center(child: Icon(Icons.card_giftcard, size: 26, color: Colors.black87)),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 20),
                                const Text('My Referrals', style: TextStyle(fontFamily: 'Recoleta', fontSize: 18, fontWeight: FontWeight.bold)),
                                const SizedBox(height: 8),
                                Container(
                                  height: 60,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(16),
                                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                                  ),
                                  child: Material(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(16),
                                      onTap: () {}, // Add your navigation/action here
                                      child: const Center(child: Icon(Icons.group_outlined, size: 26, color: Colors.black87)),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      
                      // News Section
                      const Text('News', style: TextStyle(fontFamily: 'Recoleta', fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.asset('assets/images/barista_craft_banner.png', width: 100, height: 100, fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('C2 Barista Craft', style: TextStyle(fontFamily: 'Recoleta', fontSize: 18, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 6),
                                  Text('Discover our new handcrafted joy and playful sips.', style: TextStyle(fontFamily: 'Afacad', fontSize: 16, color: Colors.grey)),
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
                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child: Image.asset('assets/images/promo_banner_2.png', width: 100, height: 100, fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('Skip the Queue', style: TextStyle(fontFamily: 'Recoleta', fontSize: 18, fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 6),
                                  Text('Order ahead with mobile ordering and save time.', style: TextStyle(fontFamily: 'Afacad', fontSize: 16, color: Colors.grey)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      
                      // Calendar Section
                      const Text('Calendar', style: TextStyle(fontFamily: 'Recoleta', fontSize: 20, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0),
                        child: CustomCalendarWidget(),
                      ),
                      const SizedBox(height: 24),
                      
                      // Our Promise Section
                      const Text('Our Promise', style: TextStyle(fontFamily: 'Recoleta', fontSize: 20, fontWeight: FontWeight.bold)),
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
          
          // Bottom Navigation
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: CustomBottomNav(
              selectedIndex: 4,
              onItemTapped: _onBottomNavTapped,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPromiseCard(String text) {
    return Container(
      width: 150,
      margin: const EdgeInsets.only(right: 12, bottom: 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 5, offset: const Offset(0, 2))],
      ),
      child: Center(
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontFamily: 'Recoleta',
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: orangeColor,
          ),
        ),
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
    final int daysInMonth = DateUtils.getDaysInMonth(_currentMonth.year, _currentMonth.month);
    final int firstWeekday = DateTime(_currentMonth.year, _currentMonth.month, 1).weekday;
    
    // adjust for Monday=1, Sunday=7 in dart. 
    // We want Monday to be the first column (index 0)
    final int emptySlots = firstWeekday - 1; 

    final List<String> monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    final List<String> dayNames = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 5))],
      ),
      child: Column(
        children: [
          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(icon: const Icon(Icons.chevron_left, color: Color(0xFFE66B00)), onPressed: _previousMonth),
              Text(
                '${monthNames[_currentMonth.month - 1]} ${_currentMonth.year}',
                style: const TextStyle(fontFamily: 'Recoleta', fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFFE66B00)),
              ),
              IconButton(icon: const Icon(Icons.chevron_right, color: Color(0xFFE66B00)), onPressed: _nextMonth),
            ],
          ),
          const SizedBox(height: 16),
          // Days of week
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: dayNames.map((day) => 
              SizedBox(
                width: 30,
                child: Center(child: Text(day, style: const TextStyle(fontFamily: 'Afacad', fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey))),
              )
            ).toList(),
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
              final DateTime date = DateTime(_currentMonth.year, _currentMonth.month, day);
              final bool isBought = _isDrinkBought(date);
              final bool isSelected = _selectedDate?.year == date.year && _selectedDate?.month == date.month && _selectedDate?.day == date.day;
              
              return GestureDetector(
                onTap: () {
                  setState(() => _selectedDate = date);
                },
                child: Container(
                  margin: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isSelected ? const Color(0xFFE66B00) : Colors.transparent,
                    border: isBought && !isSelected ? Border.all(color: const Color(0xFFE66B00), width: 1.5) : null,
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
  final PageController _pageController = PageController(viewportFraction: 0.5);
  Timer? _timer;
  int _currentPage = 0;

  final List<String> _promises = [
    '100% certified muslim-made',
    'made with love',
    'playful sips, handcrafted joy',
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 3), (Timer timer) {
      if (_currentPage < _promises.length - 1) {
        _currentPage++;
      } else {
        _currentPage = 0;
      }
      if (_pageController.hasClients) {
        _pageController.animateToPage(
          _currentPage,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
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
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 5, offset: const Offset(0, 2))],
          ),
          child: Center(
            child: Text(
              _promises[index],
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 22, // increased from 16
                fontWeight: FontWeight.bold,
                color: Color(0xFFE66B00),
              ),
            ),
          ),
        );
      },
    );
  }
}
