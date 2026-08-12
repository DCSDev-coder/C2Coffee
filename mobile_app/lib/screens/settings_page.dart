import 'dart:io';
import 'package:flutter/material.dart';
import 'loading_order_page.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/secure_session_service.dart';
import '../services/session_lifecycle_service.dart';
import '../services/user_service.dart';
import 'splash_screen.dart';
import 'privacy_policy_page.dart';
import 'terms_of_use_page.dart';
import 'about_us_page.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../utils/app_colors.dart';

class SettingsPage extends StatefulWidget {
  final VoidCallback? onProfileUpdated;
  final Widget? returnPage;
  const SettingsPage({super.key, this.onProfileUpdated, this.returnPage});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

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
      if (profileData['username'] != null) {
        userProfile['username'] = profileData['username'];
      }
      if (profileData['email'] != null) {
        userProfile['email'] = profileData['email'];
      }
      if (profileData['phone'] != null) {
        userProfile['phone'] = profileData['phone'];
      }
      if (profileData['birthday'] != null) {
        userProfile['birthday'] = profileData['birthday'];
      }
      if (profileData['gender'] != null) {
        userProfile['gender'] = profileData['gender'];
      }
      if (profileData['address'] != null) {
        userProfile['address'] = profileData['address'];
      }
    });
  }

  Future<void> _saveProfileValue(String key, String value) async {
    final nextProfile = Map<String, String?>.from(userProfile);
    nextProfile[key] = value;

    await UserService.saveUserProfile({key: value});
    userProfile = nextProfile;

    final accessToken = await SecureSessionService.instance.getAccessToken();
    if (accessToken != null && accessToken.isNotEmpty && key != 'phone') {
      try {
        final updatedUser = await AuthApiService.instance.updateProfile(
          accessToken: accessToken,
          profile: _buildApiProfilePayload(nextProfile),
        );
        await UserService.overwriteUserProfile(updatedUser.toLocalProfileMap());
        try {
          await AppSessionService.instance.loadAuthenticatedState(force: true);
        } catch (_) {}
      } on ApiException catch (error) {
        if (mounted) {
          _showSnackBar(error.message);
        }
      } catch (_) {
        if (mounted) {
          _showSnackBar('Unable to sync profile changes right now.');
        }
      }
    }

    await _loadUserData();
    widget.onProfileUpdated?.call();
  }

  Map<String, String> _buildApiProfilePayload(Map<String, String?> profile) {
    final addressParts = _parseAddress(profile['address']);

    return {
      'display_name': profile['username']?.trim().isNotEmpty == true
          ? profile['username']!.trim()
          : 'C2 Member',
      'email': profile['email']?.trim() ?? '',
      'birthday': _formatBirthdayForApi(profile['birthday']),
      'gender': profile['gender']?.trim() ?? '',
      'house_line': '',
      'street_line': addressParts.streetLine,
      'postcode': addressParts.postcode,
      'city': addressParts.city,
    };
  }

  String _formatBirthdayForApi(String? value) {
    if (value == null || value.trim().isEmpty) return '';
    final raw = value.trim();

    try {
      return DateFormat('yyyy-MM-dd')
          .format(DateFormat('dd MMM yyyy').parseStrict(raw));
    } catch (_) {
      try {
        return DateFormat('yyyy-MM-dd').format(DateTime.parse(raw));
      } catch (_) {
        return raw;
      }
    }
  }

  _AddressParts _parseAddress(String? address) {
    if (address == null || address.trim().isEmpty) {
      return const _AddressParts(streetLine: '', postcode: '', city: '');
    }

    final parts = address.split(', ').map((part) => part.trim()).toList();
    if (parts.length == 1) {
      return _AddressParts(streetLine: '', postcode: '', city: parts.first);
    }

    final streetLine = parts.first;
    var postcode = '';
    var city = '';

    if (parts.length >= 2) {
      final postcodeAndCity = parts[1].split(' ');
      if (postcodeAndCity.isNotEmpty) {
        postcode = postcodeAndCity.first;
      }
      if (postcodeAndCity.length > 1) {
        city = postcodeAndCity.sublist(1).join(' ');
      }
    }

    if (parts.length > 2) {
      city = city.isEmpty
          ? parts.sublist(2).join(', ')
          : '$city, ${parts.sublist(2).join(', ')}';
    }

    return _AddressParts(
      streetLine: streetLine,
      postcode: postcode,
      city: city,
    );
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
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
                Text('Choose Avatar',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: orangeColor)),
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
                            decoration: BoxDecoration(
                                shape: BoxShape.circle, color: orangeColor),
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
                      backgroundColor: orangeColor,
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
          color: orangeColor,
          border: Border.all(color: bgColor, width: 4),
        ),
        child: ClipOval(child: Image(image: imageProvider, fit: BoxFit.cover)),
      ),
    );
  }

  Widget _buildRowItem(String label, String value,
      {bool isAddress = false, VoidCallback? onTap, String? helperText}) {
    final isEditable = onTap != null;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: isAddress
                  ? CrossAxisAlignment.start
                  : CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 110,
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: Colors.grey,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    value.isEmpty ? 'Not set' : value,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: value.isEmpty ? Colors.grey : Colors.black87,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (isEditable) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_ios,
                      size: 14, color: Colors.grey),
                ],
              ],
            ),
            if (helperText != null) ...[
              const SizedBox(height: 6),
              Padding(
                padding: const EdgeInsets.only(left: 110),
                child: Text(
                  helperText,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showEditDialog(String label, String key, String currentValue) async {
    if (key == 'gender') {
      String selectedGender = currentValue.isEmpty ? 'Female' : currentValue;
      await showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: Text('Select Gender',
                    style: const TextStyle(fontFamily: 'Recoleta')),
                content: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: ['Female', 'Male'].map((gender) {
                    final isSelected = selectedGender == gender;
                    return ChoiceChip(
                      label: Text(
                        gender,
                        style: const TextStyle(fontFamily: 'Afacad'),
                      ),
                      selected: isSelected,
                      selectedColor: AppColors.deepTeal.withValues(alpha: 0.14),
                      side: BorderSide(
                        color: isSelected
                            ? AppColors.deepTeal
                            : Colors.grey.shade300,
                      ),
                      labelStyle: TextStyle(
                        fontFamily: 'Afacad',
                        color: isSelected ? AppColors.deepTeal : Colors.black87,
                        fontWeight:
                            isSelected ? FontWeight.w700 : FontWeight.w500,
                      ),
                      onSelected: (_) {
                        setDialogState(() {
                          selectedGender = gender;
                        });
                      },
                    );
                  }).toList(),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel',
                        style: TextStyle(color: Colors.grey)),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _saveProfileValue(key, selectedGender);
                      if (context.mounted) Navigator.pop(context);
                    },
                    child: Text('Save',
                        style: TextStyle(color: AppColors.deepTeal)),
                  ),
                ],
              );
            },
          );
        },
      );
    } else if (key == 'address') {
      String street = '';
      String city = '';
      String postcode = '';
      String stateVal = '';

      if (currentValue.isNotEmpty) {
        List<String> parts = currentValue.split(', ');
        if (parts.isNotEmpty) street = parts[0];
        if (parts.length > 1) {
          List<String> pcCity = parts[1].split(' ');
          if (pcCity.length > 1) {
            postcode = pcCity[0];
            city = pcCity.sublist(1).join(' ');
          } else {
            city = parts[1];
          }
        }
        if (parts.length > 2) stateVal = parts[2];
      }

      TextEditingController streetController =
          TextEditingController(text: street);
      TextEditingController cityController = TextEditingController(text: city);
      TextEditingController postcodeController =
          TextEditingController(text: postcode);
      TextEditingController stateController =
          TextEditingController(text: stateVal);

      final formKey = GlobalKey<FormState>();

      await showDialog(
        context: context,
        builder: (context) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: const Text('Edit Address',
                    style: TextStyle(fontFamily: 'Recoleta')),
                content: SingleChildScrollView(
                  child: Form(
                    key: formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          controller: streetController,
                          decoration: InputDecoration(
                            labelText: 'Street Address',
                            focusedBorder: UnderlineInputBorder(
                                borderSide:
                                    BorderSide(color: AppColors.deepTeal)),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter street address';
                            }
                            return null;
                          },
                        ),
                        TextFormField(
                          controller: cityController,
                          decoration: InputDecoration(
                            labelText: 'City',
                            focusedBorder: UnderlineInputBorder(
                                borderSide:
                                    BorderSide(color: AppColors.deepTeal)),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter city';
                            }
                            return null;
                          },
                        ),
                        TextFormField(
                          controller: postcodeController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Postcode',
                            focusedBorder: UnderlineInputBorder(
                                borderSide:
                                    BorderSide(color: AppColors.deepTeal)),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter postcode';
                            }
                            return null;
                          },
                        ),
                        TextFormField(
                          controller: stateController,
                          decoration: InputDecoration(
                            labelText: 'State',
                            focusedBorder: UnderlineInputBorder(
                                borderSide:
                                    BorderSide(color: AppColors.deepTeal)),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter state';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel',
                        style: TextStyle(color: Colors.grey)),
                  ),
                  TextButton(
                    onPressed: () async {
                      if (formKey.currentState!.validate()) {
                        String fullAddress =
                            '${streetController.text.trim()}, ${postcodeController.text.trim()} ${cityController.text.trim()}, ${stateController.text.trim()}';
                        await _saveProfileValue(key, fullAddress);
                        if (context.mounted) Navigator.pop(context);
                      }
                    },
                    child: Text('Save',
                        style: TextStyle(color: AppColors.deepTeal)),
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
              colorScheme: ColorScheme.light(
                primary: AppColors.deepTeal, // header background color
                onPrimary: Colors.white, // header text color
                onSurface: Colors.black, // body text color
              ),
              textButtonTheme: TextButtonThemeData(
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.deepTeal, // button text color
                ),
              ),
            ),
            child: child!,
          );
        },
      );
      if (pickedDate != null) {
        String formattedDate = DateFormat('dd MMM yyyy').format(pickedDate);
        await _saveProfileValue(key, formattedDate);
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
                focusedBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: AppColors.deepTeal)),
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
                  await _saveProfileValue(key, controller.text.trim());
                  if (context.mounted) Navigator.pop(context);
                },
                child:
                    Text('Save', style: TextStyle(color: AppColors.deepTeal)),
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
      canPop: true,
      child: Scaffold(
        backgroundColor: bgColor,
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
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => InteractiveFillingLoader.showPop(context),
                        child: const Icon(Icons.arrow_back_ios,
                            color: Colors.white, size: 20),
                      ),
                      const Expanded(
                        child: Center(
                          child: Text(
                            'SETTINGS',
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
                      const SizedBox(width: 20),
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
                                height: 50), // Space for top half of avatar

                            // Details Card
                            Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              padding: const EdgeInsets.only(
                                  top: 60, bottom: 10, left: 20, right: 20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppColors.border,
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                      color:
                                          Colors.black.withValues(alpha: 0.03),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2))
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
                                      helperText:
                                          'Phone number is your login identity and cannot be edited here.'),
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
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              child: Text('Settings',
                                  style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.deepTeal)),
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
                                border: Border.all(
                                  color: AppColors.border,
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                      color:
                                          Colors.black.withValues(alpha: 0.03),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2))
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
                                    activeThumbColor: orangeColor,
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 12),

                            // Info Links Card
                            Container(
                              margin:
                                  const EdgeInsets.symmetric(horizontal: 20),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: AppColors.border,
                                  width: 1,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                      color:
                                          Colors.black.withValues(alpha: 0.03),
                                      blurRadius: 8,
                                      offset: const Offset(0, 2))
                                ],
                              ),
                              child: Material(
                                color: Colors.transparent,
                                borderRadius: BorderRadius.circular(20),
                                clipBehavior: Clip.antiAlias,
                                child: Padding(
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 8),
                                  child: Column(
                                    children: [
                                      ListTile(
                                        title: const Text('Privacy Policy',
                                            style: TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 16,
                                                color: Colors.black87)),
                                        trailing: const Icon(
                                            Icons.arrow_forward_ios,
                                            size: 16,
                                            color: Colors.grey),
                                        onTap: () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (_) =>
                                                    const PrivacyPolicyPage())),
                                      ),
                                      const Divider(
                                          height: 1, indent: 16, endIndent: 16),
                                      ListTile(
                                        title: const Text('Terms & Conditions',
                                            style: TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 16,
                                                color: Colors.black87)),
                                        trailing: const Icon(
                                            Icons.arrow_forward_ios,
                                            size: 16,
                                            color: Colors.grey),
                                        onTap: () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (_) =>
                                                    const TermsOfUsePage())),
                                      ),
                                      const Divider(
                                          height: 1, indent: 16, endIndent: 16),
                                      ListTile(
                                        title: const Text('About Us',
                                            style: TextStyle(
                                                fontFamily: 'Afacad',
                                                fontSize: 16,
                                                color: Colors.black87)),
                                        trailing: const Icon(
                                            Icons.arrow_forward_ios,
                                            size: 16,
                                            color: Colors.grey),
                                        onTap: () => Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                                builder: (_) =>
                                                    const AboutUsPage())),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),

                            const SizedBox(height: 14),

                            // Log Out Button
                            GestureDetector(
                              onTap: () async {
                                await SessionLifecycleService.instance.logout();
                                if (!context.mounted) return;
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
                                    vertical: 12, horizontal: 20),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(16),
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
                                child: Row(
                                  children: [
                                    Icon(Icons.logout,
                                        size: 28, color: AppColors.terracotta),
                                    const SizedBox(width: 16),
                                    Text('Log Out',
                                        style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 20,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.terracotta)),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                          ],
                        ),
                        // Overlapping Avatar (now scrolls with content)
                        Positioned(
                          top: 0,
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

class _AddressParts {
  final String streetLine;
  final String postcode;
  final String city;

  const _AddressParts({
    required this.streetLine,
    required this.postcode,
    required this.city,
  });
}
