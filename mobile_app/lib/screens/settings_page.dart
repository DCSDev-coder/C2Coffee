import 'dart:io';
import 'package:c2_coffee/screens/splash_screen.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../services/user_service.dart';
import 'loading_order_page.dart';
import 'profile_page.dart';
import 'menu_page.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

class SettingsPage extends StatefulWidget {
  final VoidCallback? onProfileUpdated;
  const SettingsPage({super.key, this.onProfileUpdated});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final Color orangeColor = const Color(0xFFE66B00);
  final Color bgColor = const Color(0xFFFAF4EE);

  File? _pickedImage;
  String? _presetAvatarPath;

  Map<String, String?> userProfile = {
    'username': 'CoffeeLover1',
    'email': 'name@example.com',
    'phone': '+60 11 63793812',
    'birthday': '11 Dec 2006',
    'gender': 'Female',
    'address': 'Kuala Lumpur',
  };

  bool pushNotifications = true;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final avatarData = await UserService.getAvatar();
    final profileData = await UserService.getUserProfile();

    if (!mounted) return;

    setState(() {
      if (avatarData['pickedImagePath'] != null) {
        _pickedImage = File(avatarData['pickedImagePath']!);
      }
      _presetAvatarPath = avatarData['presetPath'] ?? 'assets/images/dato.png';

      // Update with stored profile data if available
      if (profileData['username'] != null)
        userProfile['username'] = profileData['username'];
      if (profileData['email'] != null)
        userProfile['email'] = profileData['email'];
      if (profileData['phone'] != null)
        userProfile['phone'] = profileData['phone'];
      if (profileData['birthday'] != null)
        userProfile['birthday'] = profileData['birthday'];
      if (profileData['gender'] != null)
        userProfile['gender'] = profileData['gender'];
      if (profileData['address'] != null)
        userProfile['address'] = profileData['address'];
    });
  }

  Future<void> _pickImageFromGallery() async {
    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _pickedImage = File(image.path);
        _presetAvatarPath = null;
      });
      await UserService.saveAvatar(pickedImagePath: image.path);
    }
  }

  void _showAvatarPicker() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Choose Avatar',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFE76D00))),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(_avatarOptions.length, (index) {
                    final option = _avatarOptions[index];
                    return GestureDetector(
                      onTap: () async {
                        setState(() {
                          _presetAvatarPath = option['path'];
                          _pickedImage = null;
                        });
                        await UserService.saveAvatar(
                            presetPath: option['path']);
                        widget.onProfileUpdated?.call();
                        if (context.mounted) Navigator.pop(context);
                      },
                      child: Column(
                        children: [
                          Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Color(0xFFE76D00)),
                            child:
                                Image.asset(option['path'], fit: BoxFit.cover),
                          ),
                          const SizedBox(height: 8),
                          Text(option['name'],
                              style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.black87)),
                        ],
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await _pickImageFromGallery();
                  },
                  icon: const Icon(Icons.photo_library, color: Colors.white),
                  label: const Text('Upload from Gallery',
                      style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white)),
                  style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE76D00),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(30)),
                      minimumSize: const Size(double.infinity, 48)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAvatar() {
    ImageProvider imageProvider;
    if (_pickedImage != null) {
      imageProvider = kIsWeb
          ? NetworkImage(_pickedImage!.path)
          : FileImage(_pickedImage!) as ImageProvider;
    } else if (_presetAvatarPath != null) {
      imageProvider = AssetImage(_presetAvatarPath!);
    } else {
      imageProvider = const AssetImage('assets/images/dato.png');
    }

    return GestureDetector(
      onTap: _showAvatarPicker,
      child: Container(
        width: 100,
        height: 100,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFFE76D00),
          border: Border.all(color: bgColor, width: 4),
        ),
        child: ClipOval(child: Image(image: imageProvider, fit: BoxFit.cover)),
      ),
    );
  }

  Widget _buildRowItem(String label, String value,
      {bool isAddress = false, VoidCallback? onTap}) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              flex: 2,
              child: Text(label,
                  style: const TextStyle(
                      fontFamily: 'Afacad', fontSize: 15, color: Colors.grey)),
            ),
            Expanded(
              flex: 3,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Flexible(
                    child: Text(
                      value.isNotEmpty ? value : '-',
                      style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87),
                      textAlign: TextAlign.right,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (isAddress)
                    const Icon(Icons.edit, size: 16, color: Color(0xFFE66B00))
                  else
                    const Icon(Icons.chevron_right,
                        size: 18, color: Colors.grey),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showEditDialog(
      String label, String key, String currentValue) async {
    if (key == 'gender') {
      String? selectedGender = currentValue.isNotEmpty ? currentValue : null;
      await showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(
            builder: (context, setState) {
              return AlertDialog(
                title: Text('Edit $label',
                    style: const TextStyle(fontFamily: 'Recoleta')),
                content: DropdownButton<String>(
                  value:
                      (selectedGender == 'Male' || selectedGender == 'Female')
                          ? selectedGender
                          : null,
                  isExpanded: true,
                  hint: const Text('Select Gender'),
                  items: ['Male', 'Female'].map((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
                  onChanged: (newValue) {
                    setState(() {
                      selectedGender = newValue;
                    });
                  },
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel',
                        style: TextStyle(color: Colors.grey)),
                  ),
                  TextButton(
                    onPressed: () async {
                      if (selectedGender != null) {
                        await UserService.saveUserProfile(
                            {key: selectedGender!});
                        _loadUserData();
                        widget.onProfileUpdated?.call();
                        if (context.mounted) Navigator.pop(context);
                      }
                    },
                    child: const Text('Save',
                        style: TextStyle(color: Color(0xFFE66B00))),
                  ),
                ],
              );
            },
          );
        },
      );
    } else if (key == 'birthday') {
      final DateTime? pickedDate = await showDatePicker(
        context: context,
        initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
        firstDate: DateTime(1900),
        lastDate: DateTime.now(),
        builder: (context, child) {
          return Theme(
            data: Theme.of(context).copyWith(
              colorScheme: const ColorScheme.light(
                primary: Color(0xFFE66B00), // header background color
                onPrimary: Colors.white, // header text color
                onSurface: Colors.black, // body text color
              ),
              textButtonTheme: TextButtonThemeData(
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFFE66B00), // button text color
                ),
              ),
            ),
            child: child!,
          );
        },
      );
      if (pickedDate != null) {
        String formattedDate = DateFormat('dd MMM yyyy').format(pickedDate);
        await UserService.saveUserProfile({key: formattedDate});
        _loadUserData();
        widget.onProfileUpdated?.call();
      }
    } else {
      TextEditingController controller =
          TextEditingController(text: currentValue);
      await showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text('Edit $label',
                style: const TextStyle(fontFamily: 'Recoleta')),
            content: TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'Enter $label',
                focusedBorder: const UnderlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFFE66B00))),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child:
                    const Text('Cancel', style: TextStyle(color: Colors.grey)),
              ),
              TextButton(
                onPressed: () async {
                  await UserService.saveUserProfile(
                      {key: controller.text.trim()});
                  _loadUserData();
                  widget.onProfileUpdated?.call();
                  if (context.mounted) Navigator.pop(context);
                },
                child: const Text('Save',
                    style: TextStyle(color: Color(0xFFE66B00))),
              ),
            ],
          );
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
              builder: (context) => const InteractiveFillingLoader()),
        );
      },
      child: Scaffold(
        backgroundColor: bgColor,
        body: Stack(
          children: [
            Column(
              children: [
                // Header
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.only(
                      top: 60, bottom: 60, left: 20, right: 20),
                  decoration: BoxDecoration(
                    color: orangeColor,
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
                          onTap: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const InteractiveFillingLoader(
                                  targetPage: ProfilePage(),
                                ),
                              ),
                            );
                          },
                          child: const Icon(Icons.arrow_back_ios,
                              color: Colors.white, size: 20),
                        ),
                      ),
                      const Text('SETTINGS',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                    ],
                  ),
                ),

                // Body
                Expanded(
                  child: SingleChildScrollView(
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.topCenter,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(
                                height: 60), // Space for the overlapping avatar

                            // Details Card
                            Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              padding: const EdgeInsets.only(
                                  top: 50, bottom: 10, left: 20, right: 20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x08000000),
                                      blurRadius: 10,
                                      offset: Offset(0, 4))
                                ],
                              ),
                              child: Column(
                                children: [
                                  _buildRowItem(
                                      'Username', userProfile['username'] ?? '',
                                      onTap: () => _showEditDialog(
                                          'Username',
                                          'username',
                                          userProfile['username'] ?? '')),
                                  _buildRowItem(
                                      'Email', userProfile['email'] ?? '',
                                      onTap: () => _showEditDialog('Email',
                                          'email', userProfile['email'] ?? '')),
                                  _buildRowItem('Phone Number',
                                      userProfile['phone'] ?? '',
                                      onTap: () => _showEditDialog(
                                          'Phone Number',
                                          'phone',
                                          userProfile['phone'] ?? '')),
                                  _buildRowItem(
                                      'Birthday', userProfile['birthday'] ?? '',
                                      onTap: () => _showEditDialog(
                                          'Birthday',
                                          'birthday',
                                          userProfile['birthday'] ?? '')),
                                  _buildRowItem(
                                      'Gender', userProfile['gender'] ?? '',
                                      onTap: () => _showEditDialog(
                                          'Gender',
                                          'gender',
                                          userProfile['gender'] ?? '')),
                                  _buildRowItem(
                                      'Address', userProfile['address'] ?? '',
                                      isAddress: true,
                                      onTap: () => _showEditDialog(
                                          'Address',
                                          'address',
                                          userProfile['address'] ?? '')),
                                ],
                              ),
                            ),

                            const SizedBox(height: 24),

                            // Settings Text
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 20),
                              child: Text('Settings',
                                  style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.black87)),
                            ),

                            const SizedBox(height: 12),

                            // Push Notifications Card
                            Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 20, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x08000000),
                                      blurRadius: 10,
                                      offset: Offset(0, 4))
                                ],
                              ),
                              child: Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Push Notifications',
                                      style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 16,
                                          color: Colors.grey)),
                                  Switch(
                                    value: pushNotifications,
                                    onChanged: (val) {
                                      setState(() {
                                        pushNotifications = val;
                                      });
                                    },
                                    activeColor: orangeColor,
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 40),

                            // Log Out Button
                            GestureDetector(
                              onTap: () {
                                // Perform logout
                                Navigator.pushAndRemoveUntil(
                                  context,
                                  MaterialPageRoute(
                                      builder: (context) =>
                                          const SplashScreen()),
                                  (Route<dynamic> route) => false,
                                );
                              },
                              child: Container(
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 20),
                                padding: const EdgeInsets.symmetric(
                                    vertical: 16, horizontal: 20),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(20),
                                  boxShadow: const [
                                    BoxShadow(
                                        color: Color(0x08000000),
                                        blurRadius: 10,
                                        offset: Offset(0, 4))
                                  ],
                                ),
                                child: Row(
                                  children: [
                                    Image.asset('assets/images/logout.png',
                                        height: 24,
                                        errorBuilder:
                                            (context, error, stackTrace) =>
                                                const Icon(Icons.exit_to_app,
                                                    color: Color(0xFFE76D00))),
                                    const SizedBox(width: 16),
                                    const Text('Log Out',
                                        style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.black)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 40),
                          ],
                        ),
                        // Overlapping Avatar (now scrolls with content)
                        Positioned(
                          top: 10,
                          child: _buildAvatar(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
