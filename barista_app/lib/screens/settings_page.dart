import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../main.dart';
import '../services/api_service.dart';
import '../widgets/active_barista_profile.dart';
import '../widgets/blinking_online_indicator.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);
  final Color switchOrange = const Color(0xFFE07A5F);

  @override
  void initState() {
    super.initState();
    _refreshBaristas();
  }

  Future<void> _refreshBaristas() async {
    final baristas = await ApiService.fetchBaristas();
    if (baristas.isNotEmpty) {
      globalBaristas.value = baristas;
      if (!baristas.contains(globalActiveBarista.value)) {
        globalActiveBarista.value = baristas.first;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 800),
              child: ListView(
                padding: const EdgeInsets.only(
                  top: 100,
                  bottom: 180,
                ), // padding to scroll past the header and floating bottom bar
                children: [
                  // Content
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24.0,
                      vertical: 16.0,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Title
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Settings',
                                    style: TextStyle(
                                      color: darkGreen,
                                      fontSize: 32,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    'Manage your shift preferences and active barista profile',
                                    style: TextStyle(
                                      color: beigeColor,
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 32.0),

                        // Active Staff Section
                        Text(
                          'Active Staff',
                          style: TextStyle(
                            color: darkGreen,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 16.0),

                        // Animated Staff List
                        ValueListenableBuilder<List<String>>(
                          valueListenable: globalBaristas,
                          builder: (context, allBaristas, _) {
                            return ValueListenableBuilder<String>(
                              valueListenable: globalActiveBarista,
                              builder: (context, activeBarista, _) {
                                return SizedBox(
                                  height:
                                      allBaristas.length *
                                      90.0, // items, 80 height + 10 padding
                                  child: Stack(
                                    children: allBaristas.map((name) {
                                      int physicalIndex;
                                      if (name == activeBarista) {
                                        physicalIndex = 0;
                                      } else {
                                        // The inactive ones keep their relative order
                                        int relativeIndex = allBaristas
                                            .where((b) => b != activeBarista)
                                            .toList()
                                            .indexOf(name);
                                        physicalIndex = relativeIndex + 1;
                                      }

                                      return AnimatedPositioned(
                                        key: ValueKey(name),
                                        duration: const Duration(
                                          milliseconds: 500,
                                        ),
                                        curve: Curves.easeOutCubic,
                                        top: physicalIndex * 90.0,
                                        left: 0,
                                        right: 0,
                                        height: 80.0,
                                        child: _buildAestheticCard(
                                          name,
                                          isActive: name == activeBarista,
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                );
                              },
                            );
                          },
                        ),


                        const SizedBox(height: 48.0),
                        
                        // Log Out Button
                        ElevatedButton(
                          onPressed: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (context) => const LoginPage()),
                            );
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDF7E65), // orange color
                            padding: const EdgeInsets.symmetric(vertical: 16.0),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16.0),
                            ),
                          ),
                          child: const Text(
                            'Log Out',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ), // closes ListView
            ), // closes ConstrainedBox
          ), // closes Center
          // Dark Green Top Header (Fixed)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 110,
              padding: const EdgeInsets.only(top: 40, left: 24, right: 24),
              decoration: BoxDecoration(
                color: darkGreen,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16.0),
                  bottomRight: Radius.circular(16.0),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Row(
                    children: [
                      Image.asset(
                        'assets/images/c2_logo.png',
                        height: 40,
                      ),
                    ],
                  ),
                  const BlinkingOnlineIndicator(),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAestheticCard(String name, {required bool isActive}) {
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '';

    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 20.0),
      decoration: BoxDecoration(
        color: isActive ? darkGreen : Colors.white,
        borderRadius: BorderRadius.circular(20.0),
        border: Border.all(
          color: isActive ? darkGreen : Colors.grey.shade200,
          width: 1.5,
        ),
        boxShadow: isActive
            ? [
                BoxShadow(
                  color: darkGreen.withOpacity(0.3),
                  blurRadius: 15,
                  offset: const Offset(0, 8),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 5,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Row(
        children: [
          // Avatar
          AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: isActive ? beigeColor : darkGreen.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initial,
                style: TextStyle(
                  color: isActive ? darkGreen : darkGreen,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          const SizedBox(width: 16.0),

              // Name
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 400),
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: isActive ? Colors.white : Colors.black87,
                  fontFamily: 'Afacad',
                ),
                child: Text(name),
              ),
              const Spacer(),

              // Action Button / Icon
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: isActive
                    ? Row(
                        key: const ValueKey('check'),
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4.0),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.check,
                              color: darkGreen,
                              size: 20,
                            ),
                          ),
                        ],
                      )
                    : TextButton(
                        key: const ValueKey('switch'),
                        onPressed: () {
                          globalActiveBarista.value = name;
                        },
                        style: TextButton.styleFrom(
                          foregroundColor: switchOrange,
                          backgroundColor: switchOrange.withOpacity(0.1),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 8.0,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12.0),
                          ),
                        ),
                        child: const Text(
                          'Switch',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
              ),
            ],
          ),
        );
  }
}
