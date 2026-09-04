import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'loading_order_page.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/api_config.dart';
import '../services/secure_session_service.dart';
import '../services/session_lifecycle_service.dart';
import '../services/user_service.dart';
import 'splash_screen.dart';
import 'privacy_policy_page.dart';
import 'terms_of_use_page.dart';
import 'about_us_page.dart';
import 'contact_support_page.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/catalog_product_image.dart';

class SettingsPage extends StatefulWidget {
  final VoidCallback? onProfileUpdated;
  final Widget? returnPage;
  const SettingsPage({super.key, this.onProfileUpdated, this.returnPage});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final AppSessionService _session = AppSessionService.instance;
  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

  File? _pickedImage;
  String? _presetAvatarPath;
  String? _remoteAvatarPath;

  Map<String, String?> userProfile = {
    'username': '',
    'email': '',
    'phone': '',
    'birthday': '',
    'gender': '',
    'address': '',
    'state': '',
  };

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    _session.addListener(_handleSessionChanged);
    _loadUserData();
  }

  void _handleSessionChanged() {
    _loadUserData();
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    super.dispose();
  }

  Future<void> _loadUserData() async {
    final avatarData = await UserService.getAvatar();
    final profileData = await UserService.getUserProfile();
    final sessionProfile = _session.userProfileSnapshot;

    if (!mounted) return;

    setState(() {
      if (avatarData['pickedImagePath'] != null) {
        _pickedImage = File(avatarData['pickedImagePath']!);
      }
      final sessionAvatar = _session.user;
      final isUploadedAvatar = sessionAvatar?.avatarType == 'uploaded';
      final isPresetAvatar = sessionAvatar?.avatarType == 'preset' &&
          (sessionAvatar?.avatarValue?.startsWith('assets/') ?? false);

      _presetAvatarPath = isPresetAvatar
          ? sessionAvatar!.avatarValue
          : (avatarData['presetPath'] ?? 'assets/images/dato.png');
      _remoteAvatarPath = isUploadedAvatar ? sessionAvatar?.avatarValue : null;

      userProfile = {
        'username': sessionProfile['username']?.trim().isNotEmpty == true
            ? sessionProfile['username']
            : (profileData['username'] ?? ''),
        'email': sessionProfile['email']?.trim().isNotEmpty == true
            ? sessionProfile['email']
            : (profileData['email'] ?? ''),
        'phone': sessionProfile['phone']?.trim().isNotEmpty == true
            ? sessionProfile['phone']
            : (profileData['phone'] ?? ''),
        'birthday': sessionProfile['birthday']?.trim().isNotEmpty == true
            ? sessionProfile['birthday']
            : (profileData['birthday'] ?? ''),
        'gender': sessionProfile['gender']?.trim().isNotEmpty == true
            ? sessionProfile['gender']
            : (profileData['gender'] ?? ''),
        'address': sessionProfile['address']?.trim().isNotEmpty == true
            ? sessionProfile['address']
            : (profileData['address'] ?? ''),
        'state': sessionProfile['state']?.trim().isNotEmpty == true
            ? sessionProfile['state']
            : (profileData['state'] ?? ''),
      };
    });
  }

  Future<void> _saveProfileValue(String key, String value) async {
    final nextProfile = Map<String, String?>.from(userProfile);
    nextProfile[key] = value;

    await UserService.saveUserProfile({key: value});
    userProfile = nextProfile;

    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
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
      'house_line': addressParts.houseLine,
      'street_line': addressParts.streetLine,
      'postcode': addressParts.postcode,
      'city': [
        addressParts.city,
      ].whereType<String>().join(', '),
      'state': profile['state']?.trim() ?? '',
      'avatar_type': _session.user?.avatarType ?? 'preset',
      'avatar_value': _session.user?.avatarValue ?? '',
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
      return const _AddressParts(
        houseLine: '',
        streetLine: '',
        postcode: '',
        city: '',
      );
    }

    final parts = address.split(', ').map((part) => part.trim()).toList();
    if (parts.length == 1) {
      return _AddressParts(
        houseLine: '',
        streetLine: '',
        postcode: '',
        city: parts.first,
      );
    }

    final houseLine = parts.first;
    var streetLine = '';
    var postcode = '';
    var city = '';

    if (parts.length >= 2) {
      streetLine = parts[1];
    }

    if (parts.length >= 3) {
      final postcodeAndCity = parts[2]
          .split(RegExp(r'\s+'))
          .where((part) => part.isNotEmpty)
          .toList();
      if (postcodeAndCity.isNotEmpty) {
        postcode = postcodeAndCity.first;
      }
      if (postcodeAndCity.length > 1) {
        city = postcodeAndCity.sublist(1).join(' ');
      }
    }

    return _AddressParts(
      houseLine: houseLine,
      streetLine: streetLine,
      postcode: postcode,
      city: city,
    );
  }

  void _showSnackBar(String message) {
    AppNotification.showError(context, message);
  }

  Future<void> _pickImageFromGallery() async {
    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    if (image == null) return;

    final bytes = await image.readAsBytes();
    if (bytes.length > 5 * 1024 * 1024) {
      if (mounted) _showSnackBar('Please choose an image smaller than 5 MB.');
      return;
    }

    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      if (mounted) {
        _showSnackBar('Please sign in again before changing your avatar.');
      }
      return;
    }

    try {
      final updatedUser = await AuthApiService.instance.uploadAvatar(
        accessToken: accessToken,
        fileName: image.name,
        mimeType: _avatarMimeType(image.name),
        bytes: bytes,
      );
      await UserService.saveAvatar(pickedImagePath: image.path);
      await UserService.overwriteUserProfile(updatedUser.toLocalProfileMap());
      await AppSessionService.instance.loadAuthenticatedState(force: true);
      if (!mounted) return;
      setState(() {
        _pickedImage = null;
        _presetAvatarPath = null;
        _remoteAvatarPath = updatedUser.avatarValue;
      });
      widget.onProfileUpdated?.call();
    } on ApiException catch (error) {
      if (mounted) _showSnackBar(error.message);
    } catch (_) {
      if (mounted) _showSnackBar('Unable to upload your avatar right now.');
    }
  }

  String _avatarMimeType(String fileName) {
    final lower = fileName.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  Future<void> _savePresetAvatar(String path) async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    if (accessToken == null || accessToken.isEmpty) {
      if (mounted) {
        _showSnackBar('Please sign in again before changing your avatar.');
      }
      return;
    }

    try {
      final payload = _buildApiProfilePayload(userProfile)
        ..['avatar_type'] = 'preset'
        ..['avatar_value'] = path;
      final updatedUser = await AuthApiService.instance.updateProfile(
        accessToken: accessToken,
        profile: payload,
      );
      await UserService.saveAvatar(presetPath: path);
      await UserService.overwriteUserProfile(updatedUser.toLocalProfileMap());
      await AppSessionService.instance.loadAuthenticatedState(force: true);
      if (!mounted) return;
      setState(() {
        _presetAvatarPath = path;
        _pickedImage = null;
        _remoteAvatarPath = null;
      });
      widget.onProfileUpdated?.call();
    } on ApiException catch (error) {
      if (mounted) _showSnackBar(error.message);
    } catch (_) {
      if (mounted) _showSnackBar('Unable to save your avatar right now.');
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
                        await _savePresetAvatar(option['path']);
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
    if (_remoteAvatarPath != null && _remoteAvatarPath!.isNotEmpty) {
      final apiOrigin = ApiConfig.baseUrl.replaceFirst(RegExp(r'/v1/?$'), '');
      final remotePath = _remoteAvatarPath!;
      imageProvider = NetworkImage(
        remotePath.startsWith('/')
            ? '$apiOrigin$remotePath'
            : '$apiOrigin/$remotePath',
      );
    } else if (_pickedImage != null) {
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
        child: ClipOval(
          child: Image(
            image: imageProvider,
            fit: BoxFit.cover,
            loadingBuilder: (_, child, loadingProgress) =>
                loadingProgress == null ? child : const C2ImageSkeleton(),
            errorBuilder: (_, __, ___) =>
                const Icon(Icons.person, size: 48, color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _buildRowItem(String label, String value,
      {VoidCallback? onTap, String? helperText}) {
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
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SizedBox(
                  width: 110,
                  child: Text(
                    label,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: Colors.black54,
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    value.isEmpty ? 'Not set' : value,
                    textAlign: TextAlign.right,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: value.isEmpty ? Colors.black54 : Colors.black87,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (isEditable) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_ios,
                      size: 14, color: Colors.black54),
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
                    color: Colors.black54,
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
    if (key == 'email') {
      await _showEmailChangeFlow();
      return;
    }

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
      final parsedAddress = _parseAddress(currentValue);
      String house = parsedAddress.houseLine;
      String street = '';
      String city = parsedAddress.city;
      String postcode = parsedAddress.postcode;
      String stateVal = userProfile['state']?.trim().isNotEmpty == true
          ? userProfile['state']!.trim()
          : '';
      street = parsedAddress.streetLine;

      TextEditingController houseController =
          TextEditingController(text: house);
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
                          controller: houseController,
                          decoration: InputDecoration(
                            labelText: 'Unit / House No.',
                            focusedBorder: UnderlineInputBorder(
                              borderSide: BorderSide(color: AppColors.deepTeal),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Please enter house or unit';
                            }
                            return null;
                          },
                        ),
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
                            '${houseController.text.trim()}, ${streetController.text.trim()}, ${postcodeController.text.trim()} ${cityController.text.trim()}';
                        await UserService.saveUserProfile(
                          {'state': stateController.text.trim()},
                        );
                        userProfile['state'] = stateController.text.trim();
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

  Future<void> _showEmailChangeFlow() async {
    final email = await showDialog<String>(
      context: context,
      builder: (_) => _EmailChangeRequestDialog(
        initialEmail: userProfile['email'] ?? '',
      ),
    );
    if (email == null || email.isEmpty || !email.contains('@')) return;

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Please sign in again before changing your email.');
      }
      final request = await AuthApiService.instance.requestEmailChange(
        accessToken: accessToken,
        email: email,
      );
      if (!mounted) return;

      final code = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _EmailChangeOtpDialog(
          email: email,
          expiresInSeconds: request.expiresInSeconds,
        ),
      );
      if (code == null || code.length != 6) return;

      final updatedUser = await AuthApiService.instance.confirmEmailChange(
        accessToken: accessToken,
        requestId: request.requestId,
        otpCode: code,
      );
      await UserService.overwriteUserProfile(updatedUser.toLocalProfileMap());
      await _session.loadAuthenticatedState(force: true);
      await _loadUserData();
      if (mounted) {
        _showSnackBar('Your email address has been verified and updated.');
      }
    } on ApiException catch (error) {
      if (mounted) _showSnackBar(error.message);
    } catch (_) {
      if (mounted) _showSnackBar('Unable to update your email right now.');
    }
  }

  Future<void> _showAccountClosureDialog() async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Close Account',
            style:
                TextStyle(fontFamily: 'Recoleta', color: AppColors.terracotta)),
        content: TextField(
          controller: reasonController,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Reason for closure',
            helperText:
                'This immediately signs you out. Required financial records are retained securely.',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () =>
                Navigator.pop(context, reasonController.text.trim()),
            child: Text('Close Account',
                style: TextStyle(color: AppColors.terracotta)),
          ),
        ],
      ),
    );
    if (reason == null || reason.length < 5) {
      if (mounted && reason != null) {
        _showSnackBar(
            'Please provide at least 5 characters for the closure reason.');
      }
      return;
    }

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Please sign in again before closing your account.');
      }
      await AuthApiService.instance.requestAccountClosure(
        accessToken: accessToken,
        reason: reason,
      );
      await SessionLifecycleService.instance.logout();
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const SplashScreen()),
        (route) => false,
      );
    } on ApiException catch (error) {
      if (mounted) _showSnackBar(error.message);
    } catch (_) {
      if (mounted) _showSnackBar('Unable to close your account right now.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'SETTINGS',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: bgColor,
        bodyPadding: EdgeInsets.only(
          top: 20,
          bottom: MediaQuery.paddingOf(context).bottom + 20,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.topCenter,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 50), // Space for top half of avatar

                // Details Card
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
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
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 8,
                          offset: const Offset(0, 2))
                    ],
                  ),
                  child: Column(
                    children: [
                      _buildRowItem('Username', userProfile['username'] ?? '',
                          onTap: () => _showEditDialog('Username', 'username',
                              userProfile['username'] ?? '')),
                      _buildRowItem('Email', userProfile['email'] ?? '',
                          onTap: () => _showEditDialog(
                              'Email', 'email', userProfile['email'] ?? '')),
                      _buildRowItem(
                        'Phone Number',
                        userProfile['phone'] ?? '',
                      ),
                      _buildRowItem('Birthday', userProfile['birthday'] ?? '',
                          onTap: () => _showEditDialog('Birthday', 'birthday',
                              userProfile['birthday'] ?? '')),
                      _buildRowItem('Gender', userProfile['gender'] ?? '',
                          onTap: () => _showEditDialog(
                              'Gender', 'gender', userProfile['gender'] ?? '')),
                      _buildRowItem('Address', userProfile['address'] ?? '',
                          onTap: () => _showEditDialog('Address', 'address',
                              userProfile['address'] ?? '')),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Settings Text
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text('Settings',
                      style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal)),
                ),

                const SizedBox(height: 12),

                // Info Links Card
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
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
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        children: [
                          ListTile(
                            title: const Text('Contact Support',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: Colors.black87)),
                            trailing: const Icon(Icons.arrow_forward_ios,
                                size: 16, color: Colors.grey),
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) =>
                                        const ContactSupportPage())),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: const Text('Privacy Policy',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: Colors.black87)),
                            trailing: const Icon(Icons.arrow_forward_ios,
                                size: 16, color: Colors.grey),
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const PrivacyPolicyPage())),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: const Text('Terms & Conditions',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: Colors.black87)),
                            trailing: const Icon(Icons.arrow_forward_ios,
                                size: 16, color: Colors.grey),
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const TermsOfUsePage())),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: const Text('About Us',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: Colors.black87)),
                            trailing: const Icon(Icons.arrow_forward_ios,
                                size: 16, color: Colors.grey),
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const AboutUsPage())),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: Text('Close Account',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 16,
                                    color: AppColors.terracotta)),
                            subtitle: const Text(
                              'Request closure and sign out from all devices',
                              style:
                                  TextStyle(fontFamily: 'Afacad', fontSize: 13),
                            ),
                            trailing: Icon(Icons.arrow_forward_ios,
                                size: 16, color: AppColors.terracotta),
                            onTap: _showAccountClosureDialog,
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
                          builder: (context) => const SplashScreen()),
                      (Route<dynamic> route) => false,
                    );
                  },
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20),
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
                            color: Colors.black.withValues(alpha: 0.03),
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
    );
  }
}

class _EmailChangeRequestDialog extends StatefulWidget {
  const _EmailChangeRequestDialog({required this.initialEmail});

  final String initialEmail;

  @override
  State<_EmailChangeRequestDialog> createState() =>
      _EmailChangeRequestDialogState();
}

class _EmailChangeRequestDialogState extends State<_EmailChangeRequestDialog> {
  late final TextEditingController _emailController;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title:
          const Text('Change Email', style: TextStyle(fontFamily: 'Recoleta')),
      content: TextField(
        controller: _emailController,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
        decoration: const InputDecoration(
          labelText: 'New email address',
          helperText: 'We will send a verification code to this address.',
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.pop(context, _emailController.text.trim()),
          child: Text('Send Code', style: TextStyle(color: AppColors.deepTeal)),
        ),
      ],
    );
  }
}

class _EmailChangeOtpDialog extends StatefulWidget {
  const _EmailChangeOtpDialog({
    required this.email,
    required this.expiresInSeconds,
  });

  final String email;
  final int expiresInSeconds;

  @override
  State<_EmailChangeOtpDialog> createState() => _EmailChangeOtpDialogState();
}

class _EmailChangeOtpDialogState extends State<_EmailChangeOtpDialog> {
  final _codeController = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_handleFocusChange);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  void _handleFocusChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _focusNode.removeListener(_handleFocusChange);
    _codeController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  String get _maskedEmail {
    final atIndex = widget.email.indexOf('@');
    if (atIndex <= 2) return widget.email;
    return '${widget.email.substring(0, 2)}${'...'}${widget.email.substring(atIndex)}';
  }

  void _onChanged(String value) {
    final digits = value.replaceAll(RegExp(r'[^0-9]'), '');
    final nextValue = digits.length > 6 ? digits.substring(0, 6) : digits;
    if (nextValue != value) {
      _codeController.value = TextEditingValue(
        text: nextValue,
        selection: TextSelection.collapsed(offset: nextValue.length),
      );
      return;
    }
    if (nextValue.length == 6) _focusNode.unfocus();
    setState(() {});
  }

  void _submit() {
    final code = _codeController.text;
    if (code.length != 6) return;
    Navigator.pop(context, code);
  }

  @override
  Widget build(BuildContext context) {
    final code = _codeController.text;
    final minutes = (widget.expiresInSeconds / 60).ceil();

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(28, 30, 28, 22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Verify New Email',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 30,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Enter the 6-digit code sent to $_maskedEmail. It expires in $minutes minutes.',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                height: 1.25,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 28),
            GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _focusNode.requestFocus,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0,
                      child: TextField(
                        controller: _codeController,
                        focusNode: _focusNode,
                        keyboardType: TextInputType.number,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.oneTimeCode],
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(6),
                        ],
                        onChanged: _onChanged,
                        onSubmitted: (_) => _submit(),
                        decoration: const InputDecoration(
                          border: InputBorder.none,
                          counterText: '',
                          contentPadding: EdgeInsets.zero,
                          isCollapsed: true,
                        ),
                      ),
                    ),
                  ),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: _codeController,
                    builder: (context, value, _) {
                      final digits = value.text;
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (index) {
                          final hasValue = index < digits.length;
                          final isActive = _focusNode.hasFocus &&
                              index == digits.length.clamp(0, 5);
                          return AnimatedContainer(
                            duration: const Duration(milliseconds: 120),
                            width: 40,
                            height: 52,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isActive
                                    ? const Color(0xFFD4AF37)
                                    : AppColors.deepTeal,
                                width: isActive ? 2.4 : 1.5,
                              ),
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              hasValue ? digits[index] : '',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          );
                        }),
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 26),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: code.length == 6 ? _submit : null,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.deepTeal,
                    disabledBackgroundColor:
                        AppColors.deepTeal.withValues(alpha: 0.25),
                  ),
                  child: const Text('Verify'),
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
  final String houseLine;
  final String streetLine;
  final String postcode;
  final String city;

  const _AddressParts({
    required this.houseLine,
    required this.streetLine,
    required this.postcode,
    required this.city,
  });
}
