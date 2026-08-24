import 'package:flutter/material.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final Color darkGreen = const Color(0xFF304A3A);
  final Color beigeColor = const Color(0xFFD3B17D);
  final Color switchOrange = const Color(0xFFE07A5F);
  
  final List<String> _allBaristas = ['Barista 1', 'Barista 2', 'Barista 3'];
  String _activeBarista = 'Barista 1';
  
  bool _pushNotificationsEnabled = true;

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
            padding: const EdgeInsets.only(top: 100, bottom: 120), // padding to scroll past the header and floating bottom bar
            children: [
              // Content
              Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Title
                Text(
                  'Settings',
                  style: TextStyle(
                    color: darkGreen,
                    fontSize: 40,
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
                SizedBox(
                  height: 3 * 90.0, // 3 items, 80 height + 10 padding
                  child: Stack(
                    children: _allBaristas.map((name) {
                      int physicalIndex;
                      if (name == _activeBarista) {
                        physicalIndex = 0;
                      } else {
                        // The inactive ones keep their relative order
                        int relativeIndex = _allBaristas
                            .where((b) => b != _activeBarista)
                            .toList()
                            .indexOf(name);
                        physicalIndex = relativeIndex + 1;
                      }

                      return AnimatedPositioned(
                        key: ValueKey(name),
                        duration: const Duration(milliseconds: 500),
                        curve: Curves.easeOutCubic,
                        top: physicalIndex * 90.0,
                        left: 0,
                        right: 0,
                        height: 80.0,
                        child: _buildAestheticCard(name, isActive: name == _activeBarista),
                      );
                    }).toList(),
                  ),
                ),
                
                const SizedBox(height: 24.0),
                
                // Shift Preference Section
                Text(
                  'Shift Preference',
                  style: TextStyle(
                    color: darkGreen,
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16.0),
                
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    border: Border.all(color: Colors.grey.shade200, width: 1.5),
                    borderRadius: BorderRadius.circular(20.0),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.02),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Push Notifications',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Receive alerts for new orders.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Colors.grey.shade500,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      Switch(
                        value: _pushNotificationsEnabled,
                        onChanged: (val) {
                          setState(() {
                            _pushNotificationsEnabled = val;
                          });
                        },
                        activeColor: Colors.white,
                        activeTrackColor: darkGreen,
                        inactiveThumbColor: Colors.white,
                        inactiveTrackColor: Colors.grey.shade300,
                      ),
                    ],
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
              height: 100,
              decoration: BoxDecoration(
                color: darkGreen,
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(16.0),
                  bottomRight: Radius.circular(16.0),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildAestheticCard(String name, {required bool isActive}) {
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
                )
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 5,
                  offset: const Offset(0, 2),
                )
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
            child: Icon(
              Icons.person,
              color: isActive ? darkGreen : darkGreen,
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
                ? Container(
                    key: const ValueKey('check'),
                    padding: const EdgeInsets.all(4.0),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(Icons.check, color: darkGreen, size: 20),
                  )
                : TextButton(
                    key: const ValueKey('switch'),
                    onPressed: () {
                      setState(() {
                        _activeBarista = name;
                      });
                    },
                    style: TextButton.styleFrom(
                      foregroundColor: switchOrange,
                      backgroundColor: switchOrange.withOpacity(0.1),
                      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
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
