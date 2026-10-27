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
import '../services/notification_service.dart';
import '../services/user_service.dart';
import 'splash_screen.dart';
import 'privacy_policy_page.dart';
import 'terms_of_use_page.dart';
import 'about_us_page.dart';
import 'contact_support_page.dart';
import 'tutorial_page.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/catalog_product_image.dart';
import '../widgets/profile_avatar_style.dart';

class SettingsPage extends StatefulWidget {
  final VoidCallback? onProfileUpdated;
  final Widget? returnPage;
  const SettingsPage({super.key, this.onProfileUpdated, this.returnPage});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  static const Color _destructiveActionColor = Color(0xFFD32F2F);

  final AppSessionService _session = AppSessionService.instance;
  Color get orangeColor => AppColors.deepTeal;
  final Color bgColor = Colors.white;

  File? _pickedImage;
  String? _presetAvatarPath;
  String? _remoteAvatarPath;
  bool _marketingNotifications = true;
  bool _marketingPreferenceLoading = true;

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
    _loadMarketingNotificationPreference();
  }

  void _handleSessionChanged() {
    _loadUserData();
  }

  Future<void> _loadMarketingNotificationPreference() async {
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) return;
      final enabled = await NotificationService.instance.getMarketingPreference(
        accessToken: accessToken,
      );
      if (mounted) setState(() => _marketingNotifications = enabled);
    } catch (_) {
      // Marketing defaults to enabled until a saved preference is available.
    } finally {
      if (mounted) setState(() => _marketingPreferenceLoading = false);
    }
  }

  Future<void> _setMarketingNotificationPreference(bool enabled) async {
    final previous = _marketingNotifications;
    setState(() => _marketingNotifications = enabled);
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Sign in required.');
      }
      await NotificationService.instance.updateMarketingPreference(
        accessToken: accessToken,
        enabled: enabled,
      );
    } catch (_) {
      if (mounted) {
        setState(() => _marketingNotifications = previous);
        _showSnackBar('Unable to update marketing notifications right now.');
      }
    }
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
      _pickedImage = avatarData['pickedImagePath'] != null
          ? File(avatarData['pickedImagePath']!)
          : null;
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
          _showSnackBar(friendlyCustomerErrorMessage(
            error,
            fallback: 'Unable to sync profile changes right now.',
          ));
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
      if (mounted) {
        _showSnackBar(friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to upload your avatar right now.',
        ));
      }
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
      if (mounted) {
        _showSnackBar(friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to save your avatar right now.',
        ));
      }
    } catch (_) {
      if (mounted) _showSnackBar('Unable to save your avatar right now.');
    }
  }

  void _showAvatarPicker() {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        final String currentSelection = (_remoteAvatarPath != null || _pickedImage != null)
            ? 'custom'
            : (_presetAvatarPath ?? 'assets/images/dato.png');

        return Dialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildDialogHeader(
                  context: context,
                  icon: Icons.face_retouching_natural_rounded,
                  title: 'Choose Your Look',
                  subtitle:
                      'Pick a signature C2 character or upload your own photo.',
                ),
                const SizedBox(height: 22),
                Row(
                  children: List.generate(_avatarOptions.length, (index) {
                    final option = _avatarOptions[index];
                    final isSelected = currentSelection == option['path'];
                    return Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          left: index == 0 ? 0 : 8,
                          right: index == _avatarOptions.length - 1 ? 0 : 8,
                        ),
                        child: GestureDetector(
                          onTap: () async {
                            await _savePresetAvatar(option['path']);
                            if (context.mounted) Navigator.pop(context);
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            padding: const EdgeInsets.symmetric(
                                vertical: 16, horizontal: 12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.surfaceLight
                                  : const Color(0xFFF8F9FA),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: isSelected
                                    ? orangeColor
                                    : Colors.grey.shade200,
                                width: isSelected ? 2 : 1,
                              ),
                            ),
                            child: Column(
                              children: [
                                Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    Container(
                                      width: 76,
                                      height: 76,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: profilePlaceholderBackground(
                                          gender: option['name'] == 'Datin'
                                              ? 'Female'
                                              : 'Male',
                                          presetPath: option['path'],
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: orangeColor.withValues(
                                                alpha: 0.14),
                                            blurRadius: 10,
                                            offset: const Offset(0, 4),
                                          ),
                                        ],
                                      ),
                                      child: ClipOval(
                                        child: Image.asset(
                                          option['path'],
                                          fit: BoxFit.cover,
                                        ),
                                      ),
                                    ),
                                    if (isSelected)
                                      Positioned(
                                        right: -2,
                                        bottom: -2,
                                        child: Container(
                                          padding: const EdgeInsets.all(4),
                                          decoration: BoxDecoration(
                                            color: orangeColor,
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                                color: Colors.white, width: 2),
                                          ),
                                          child: const Icon(
                                            Icons.check_rounded,
                                            size: 12,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  option['name'],
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected
                                        ? orangeColor
                                        : Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      Navigator.pop(context);
                      await _pickImageFromGallery();
                    },
                    icon: const Icon(Icons.photo_library_outlined,
                        color: Colors.white, size: 20),
                    label: const Text(
                      'Upload from Gallery',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: orangeColor,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
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
    final isPlaceholder = _remoteAvatarPath == null && _pickedImage == null;
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
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 104,
            height: 104,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isPlaceholder
                  ? profilePlaceholderBackground(
                      gender: userProfile['gender'],
                      presetPath: _presetAvatarPath,
                    )
                  : orangeColor,
              border: Border.all(color: bgColor, width: 4),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.10),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
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
          Positioned(
            right: 0,
            bottom: 2,
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: orangeColor,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.15),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(
                Icons.camera_alt_rounded,
                size: 15,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _iconForProfileLabel(String label) {
    switch (label) {
      case 'Username':
        return Icons.person_outline_rounded;
      case 'Email':
        return Icons.mail_outline_rounded;
      case 'Phone Number':
        return Icons.phone_iphone_rounded;
      case 'Birthday':
        return Icons.cake_outlined;
      case 'Gender':
        return Icons.wc_rounded;
      case 'Address':
        return Icons.location_on_outlined;
      default:
        return Icons.tune_rounded;
    }
  }

  Widget _buildRowItem(String label, String value,
      {VoidCallback? onTap, String? helperText, bool showDivider = true}) {
    final isEditable = onTap != null;
    final isEmpty = value.trim().isEmpty;

    return Column(
      children: [
         InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    _iconForProfileLabel(label),
                    size: 20,
                    color: orangeColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: Colors.black54,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        isEmpty ? 'Tap to set' : value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 17,
                          color: isEmpty
                              ? orangeColor.withValues(alpha: 0.65)
                              : Colors.black87,
                          fontWeight:
                              isEmpty ? FontWeight.w500 : FontWeight.w700,
                        ),
                      ),
                      if (helperText != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          helperText,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 13,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (isEditable) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: isEmpty
                          ? orangeColor.withValues(alpha: 0.10)
                          : const Color(0xFFF3F5F5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          isEmpty ? 'Add' : 'Edit',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: isEmpty ? orangeColor : Colors.black54,
                          ),
                        ),
                        const SizedBox(width: 3),
                        Icon(
                          Icons.arrow_forward_ios_rounded,
                          size: 11,
                          color: isEmpty ? orangeColor : Colors.black45,
                        ),
                      ],
                    ),
                  ),
                ] else ...[
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF3F5F5),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline_rounded,
                            size: 12, color: Colors.black45),
                        SizedBox(width: 4),
                        Text(
                          'Verified',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            thickness: 1,
            color: Colors.grey.withValues(alpha: 0.12),
          ),
      ],
    );
  }

  Widget _buildDialogHeader({
    required BuildContext context,
    required IconData icon,
    required String title,
    required String subtitle,
    Color? accentColor,
  }) {
    final color = accentColor ?? orangeColor;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 23,
                  fontWeight: FontWeight.bold,
                  color: color,
                  height: 1.15,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 15,
                  height: 1.3,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 6),
        InkWell(
          onTap: () => Navigator.pop(context),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close_rounded,
                size: 18, color: Colors.black54),
          ),
        ),
      ],
    );
  }

  Widget _buildDialogTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hintText,
    TextInputType? keyboardType,
    int minLines = 1,
    int maxLines = 1,
    bool autofocus = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          minLines: minLines,
          maxLines: maxLines,
          autofocus: autofocus,
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 17,
            fontWeight: FontWeight.w600,
            color: Colors.black87,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              fontWeight: FontWeight.w400,
              color: Colors.black38,
            ),
            prefixIcon: Icon(icon, size: 20, color: orangeColor),
            filled: true,
            fillColor: const Color(0xFFF7F9F9),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: Colors.grey.shade200, width: 1.2),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: orangeColor, width: 1.8),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDialogActions({
    required BuildContext context,
    required String primaryLabel,
    required VoidCallback? onPrimary,
    Color? primaryColor,
  }) {
    final activeColor = primaryColor ?? orangeColor;
    return Row(
      children: [
        Expanded(
          child: TextButton(
            onPressed: () => Navigator.pop(context),
            style: TextButton.styleFrom(
              backgroundColor: Colors.grey.shade100,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: const Text(
              'Cancel',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.black54,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: ElevatedButton(
            onPressed: onPrimary,
            style: ElevatedButton.styleFrom(
              backgroundColor: activeColor,
              disabledBackgroundColor: activeColor.withValues(alpha: 0.35),
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              primaryLabel,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }

  DateTime _parseInitialBirthday(String? raw) {
    final defaultDate = DateTime(DateTime.now().year - 22, 6, 15);
    if (raw == null || raw.trim().isEmpty) return defaultDate;
    final trimmed = raw.trim();
    try {
      return DateFormat('dd MMM yyyy').parseStrict(trimmed);
    } catch (_) {
      try {
        return DateTime.parse(trimmed);
      } catch (_) {
        return defaultDate;
      }
    }
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
              final options = [
                {
                  'label': 'Female',
                  'subtitle': 'Datin vibe',
                  'asset': 'assets/images/datin.png',
                  'icon': Icons.female_rounded,
                },
                {
                  'label': 'Male',
                  'subtitle': 'Dato vibe',
                  'asset': 'assets/images/dato.png',
                  'icon': Icons.male_rounded,
                },
              ];
              return Dialog(
                backgroundColor: Colors.white,
                surfaceTintColor: Colors.transparent,
                insetPadding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(28),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildDialogHeader(
                        context: context,
                        icon: Icons.wc_rounded,
                        title: 'Select Gender',
                        subtitle:
                            'Helps us personalise your profile style and character.',
                      ),
                      const SizedBox(height: 22),
                      Row(
                        children: options.map((opt) {
                          final gender = opt['label'] as String;
                          final isSelected = selectedGender == gender;
                          return Expanded(
                            child: Padding(
                              padding: EdgeInsets.only(
                                left: gender == 'Female' ? 0 : 7,
                                right: gender == 'Female' ? 7 : 0,
                              ),
                              child: GestureDetector(
                                onTap: () {
                                  setDialogState(() {
                                    selectedGender = gender;
                                  });
                                },
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 180),
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 18, horizontal: 12),
                                  decoration: BoxDecoration(
                                    color: isSelected
                                        ? AppColors.surfaceLight
                                        : const Color(0xFFF8F9FA),
                                    borderRadius: BorderRadius.circular(20),
                                    border: Border.all(
                                      color: isSelected
                                          ? orangeColor
                                          : Colors.grey.shade200,
                                      width: isSelected ? 2.2 : 1.2,
                                    ),
                                    boxShadow: isSelected
                                        ? [
                                            BoxShadow(
                                              color: orangeColor.withValues(
                                                  alpha: 0.10),
                                              blurRadius: 12,
                                              offset: const Offset(0, 4),
                                            ),
                                          ]
                                        : null,
                                  ),
                                  child: Column(
                                    children: [
                                      Stack(
                                        clipBehavior: Clip.none,
                                        children: [
                                          Container(
                                            width: 68,
                                            height: 68,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              color:
                                                  profilePlaceholderBackground(
                                                gender: gender,
                                                presetPath:
                                                    opt['asset'] as String,
                                              ),
                                            ),
                                            child: ClipOval(
                                              child: Image.asset(
                                                opt['asset'] as String,
                                                fit: BoxFit.cover,
                                                errorBuilder: (_, __, ___) =>
                                                    Icon(
                                                  opt['icon'] as IconData,
                                                  size: 34,
                                                  color: orangeColor,
                                                ),
                                              ),
                                            ),
                                          ),
                                          if (isSelected)
                                            Positioned(
                                              right: -2,
                                              bottom: -2,
                                              child: Container(
                                                padding:
                                                    const EdgeInsets.all(4),
                                                decoration: BoxDecoration(
                                                  color: orangeColor,
                                                  shape: BoxShape.circle,
                                                  border: Border.all(
                                                    color: Colors.white,
                                                    width: 2,
                                                  ),
                                                ),
                                                child: const Icon(
                                                  Icons.check_rounded,
                                                  size: 12,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        gender,
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 18,
                                          fontWeight: FontWeight.w700,
                                          color: isSelected
                                              ? orangeColor
                                              : Colors.black87,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        opt['subtitle'] as String,
                                        style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 13,
                                          color: Colors.black45,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),
                      _buildDialogActions(
                        context: context,
                        primaryLabel: 'Save Gender',
                        onPrimary: () async {
                          await _saveProfileValue(key, selectedGender);
                          if (context.mounted) Navigator.pop(context);
                        },
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      );
    } else if (key == 'address') {
      final parsedAddress = _parseAddress(currentValue);
      final houseController =
          TextEditingController(text: parsedAddress.houseLine);
      final streetController =
          TextEditingController(text: parsedAddress.streetLine);
      final cityController = TextEditingController(text: parsedAddress.city);
      final postcodeController =
          TextEditingController(text: parsedAddress.postcode);
      final stateController = TextEditingController(
        text: userProfile['state']?.trim().isNotEmpty == true
            ? userProfile['state']!.trim()
            : '',
      );

      final formKey = GlobalKey<FormState>();

      await showDialog(
        context: context,
        builder: (context) {
          return Dialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            insetPadding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildDialogHeader(
                      context: context,
                      icon: Icons.location_on_outlined,
                      title: 'Edit Address',
                      subtitle:
                          'All fields are optional and help us tailor your local cafe perks.',
                    ),
                    const SizedBox(height: 20),
                    _buildDialogTextField(
                      controller: houseController,
                      label: 'Unit / House No.',
                      hintText: 'e.g. No. 12, Lorong 3',
                      icon: Icons.home_outlined,
                    ),
                    const SizedBox(height: 14),
                    _buildDialogTextField(
                      controller: streetController,
                      label: 'Street Address',
                      hintText: 'e.g. Taman Sri Inderapura',
                      icon: Icons.signpost_outlined,
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          flex: 2,
                          child: _buildDialogTextField(
                            controller: postcodeController,
                            label: 'Postcode',
                            hintText: '25150',
                            icon: Icons.markunread_mailbox_outlined,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 3,
                          child: _buildDialogTextField(
                            controller: cityController,
                            label: 'City',
                            hintText: 'Kuantan',
                            icon: Icons.location_city_rounded,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    _buildDialogTextField(
                      controller: stateController,
                      label: 'State',
                      hintText: 'e.g. Pahang',
                      icon: Icons.map_outlined,
                    ),
                    const SizedBox(height: 24),
                    _buildDialogActions(
                      context: context,
                      primaryLabel: 'Save Address',
                      onPrimary: () async {
                        if (formKey.currentState!.validate()) {
                          final fullAddress = [
                            houseController.text.trim(),
                            streetController.text.trim(),
                            [
                              postcodeController.text.trim(),
                              cityController.text.trim(),
                            ].where((part) => part.isNotEmpty).join(' '),
                          ].where((part) => part.isNotEmpty).join(', ');
                          await UserService.saveUserProfile(
                            {'state': stateController.text.trim()},
                          );
                          userProfile['state'] = stateController.text.trim();
                          await _saveProfileValue(key, fullAddress);
                          if (context.mounted) Navigator.pop(context);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    } else if (key == 'birthday') {
      final initialDate = _parseInitialBirthday(currentValue);
      final DateTime? pickedDate = await showDialog<DateTime>(
        context: context,
        builder: (_) => _BirthdayPickerDialog(
          initialDate: initialDate,
          accentColor: orangeColor,
        ),
      );
      if (pickedDate != null) {
        final String formattedDate =
            DateFormat('dd MMM yyyy').format(pickedDate);
        await _saveProfileValue(key, formattedDate);
      }
    } else {
      final controller = TextEditingController(text: currentValue);
      await showDialog(
        context: context,
        builder: (context) {
          return Dialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            insetPadding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDialogHeader(
                    context: context,
                    icon: Icons.person_outline_rounded,
                    title: 'Edit $label',
                    subtitle:
                        'How should our baristas greet you when your order is ready?',
                  ),
                  const SizedBox(height: 20),
                  _buildDialogTextField(
                    controller: controller,
                    label: label,
                    hintText: 'Enter your $label',
                    icon: Icons.badge_outlined,
                    autofocus: true,
                  ),
                  const SizedBox(height: 24),
                  _buildDialogActions(
                    context: context,
                    primaryLabel: 'Save $label',
                    onPrimary: () async {
                      await _saveProfileValue(key, controller.text.trim());
                      if (context.mounted) Navigator.pop(context);
                    },
                  ),
                ],
              ),
            ),
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
      if (mounted) {
        _showSnackBar(friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to update your email right now.',
        ));
      }
    } catch (_) {
      if (mounted) _showSnackBar('Unable to update your email right now.');
    }
  }

  Future<void> _showAccountClosureDialog() async {
    final reasonController = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildDialogHeader(
                context: context,
                icon: Icons.warning_amber_rounded,
                title: 'Close Account',
                subtitle:
                    'This signs you out immediately. Financial records are retained securely as required by law.',
                accentColor: _destructiveActionColor,
              ),
              const SizedBox(height: 20),
              _buildDialogTextField(
                controller: reasonController,
                label: 'Reason for closure',
                hintText: 'Tell us how we could have served you better...',
                icon: Icons.feedback_outlined,
                minLines: 2,
                maxLines: 4,
              ),
              const SizedBox(height: 24),
              _buildDialogActions(
                context: context,
                primaryLabel: 'Close Account',
                primaryColor: _destructiveActionColor,
                onPrimary: () =>
                    Navigator.pop(context, reasonController.text.trim()),
              ),
            ],
          ),
        ),
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
      if (mounted) {
        _showSnackBar(friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to close your account right now.',
        ));
      }
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
                const SizedBox(height: 52), // Space for top half of avatar

                // Details Card
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.only(
                      top: 62, bottom: 12, left: 16, right: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                      color: AppColors.border,
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 12,
                          offset: const Offset(0, 4))
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
                          showDivider: false,
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
                          fontSize: 20,
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
                          SwitchListTile(
                            title: const Text('Marketing updates',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 18,
                                    color: Colors.black87)),
                            subtitle: const Text(
                              'Offers and campaign announcements. Order, token, and account alerts stay on.',
                              style:
                                  TextStyle(fontFamily: 'Afacad', fontSize: 15),
                            ),
                            value: _marketingNotifications,
                            onChanged: _marketingPreferenceLoading
                                ? null
                                : _setMarketingNotificationPreference,
                            activeThumbColor: AppColors.deepTeal,
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: const Text('Tutorial & Help',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 18,
                                    color: Colors.black87)),
                            subtitle: const Text(
                              'Learn how ordering, tokens, rewards and pickup work.',
                              style:
                                  TextStyle(fontFamily: 'Afacad', fontSize: 15),
                            ),
                            trailing: const Icon(Icons.arrow_forward_ios,
                                size: 16, color: Colors.grey),
                            onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute<void>(
                                builder: (_) => const TutorialPage(),
                              ),
                            ),
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                          ListTile(
                            title: const Text('Contact Support',
                                style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 18,
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
                                    fontSize: 18,
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
                                    fontSize: 18,
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
                                    fontSize: 18,
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
                                    fontFamily: 'Recoleta',
                                    fontSize: 20,
                                    fontWeight: FontWeight.w700,
                                    color: _destructiveActionColor)),
                            subtitle: const Text(
                              'Request closure and sign out from all devices',
                              style:
                                  TextStyle(fontFamily: 'Afacad', fontSize: 15),
                            ),
                            trailing: Icon(Icons.arrow_forward_ios,
                                size: 16, color: _destructiveActionColor),
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
                        color: _destructiveActionColor,
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
                            size: 28, color: _destructiveActionColor),
                        const SizedBox(width: 16),
                        Text('Log Out',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: _destructiveActionColor)),
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

class _BirthdayPickerDialog extends StatefulWidget {
  const _BirthdayPickerDialog({
    required this.initialDate,
    required this.accentColor,
  });

  final DateTime initialDate;
  final Color accentColor;

  @override
  State<_BirthdayPickerDialog> createState() => _BirthdayPickerDialogState();
}

class _BirthdayPickerDialogState extends State<_BirthdayPickerDialog> {
  static const List<String> _monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  late final List<int> _years;
  late int _selectedYear;
  late int _selectedMonth;
  late int _selectedDay;

  late final FixedExtentScrollController _dayController;
  late final FixedExtentScrollController _monthController;
  late final FixedExtentScrollController _yearController;

  @override
  void initState() {
    super.initState();
    final currentYear = DateTime.now().year;
    _years = List<int>.generate(
      currentYear - 1920 + 1,
      (index) => 1920 + index,
    );
    _selectedYear = widget.initialDate.year.clamp(1920, currentYear);
    _selectedMonth = widget.initialDate.month.clamp(1, 12);
    final maxDays = _daysInMonth(_selectedYear, _selectedMonth);
    _selectedDay = widget.initialDate.day.clamp(1, maxDays);

    _dayController = FixedExtentScrollController(initialItem: _selectedDay - 1);
    _monthController =
        FixedExtentScrollController(initialItem: _selectedMonth - 1);
    _yearController = FixedExtentScrollController(
      initialItem: _years.indexOf(_selectedYear).clamp(0, _years.length - 1),
    );
  }

  @override
  void dispose() {
    _dayController.dispose();
    _monthController.dispose();
    _yearController.dispose();
    super.dispose();
  }

  int _daysInMonth(int year, int month) {
    final now = DateTime.now();
    final totalDays = DateUtils.getDaysInMonth(year, month);
    if (year == now.year && month == now.month) {
      return now.day.clamp(1, totalDays);
    }
    return totalDays;
  }

  int _maxAllowedMonth(int year) {
    final now = DateTime.now();
    return year == now.year ? now.month : 12;
  }

  void _clampDateIfNeeded() {
    final maxMonth = _maxAllowedMonth(_selectedYear);
    if (_selectedMonth > maxMonth) {
      _selectedMonth = maxMonth;
      if (_monthController.hasClients) {
        _monthController.jumpToItem(_selectedMonth - 1);
      }
    }
    final maxDay = _daysInMonth(_selectedYear, _selectedMonth);
    if (_selectedDay > maxDay) {
      _selectedDay = maxDay;
      if (_dayController.hasClients) {
        _dayController.jumpToItem(_selectedDay - 1);
      }
    }
  }

  DateTime get _currentSelectedDate =>
      DateTime(_selectedYear, _selectedMonth, _selectedDay);

  Widget _buildWheelColumn({
    required String label,
    required FixedExtentScrollController controller,
    required int itemCount,
    required String Function(int index) itemLabelBuilder,
    required ValueChanged<int> onSelectedItemChanged,
    int flex = 1,
  }) {
    return Expanded(
      flex: flex,
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Colors.black45,
            ),
          ),
          const SizedBox(height: 6),
          SizedBox(
            height: 156,
            child: ListWheelScrollView.useDelegate(
              controller: controller,
              itemExtent: 42,
              perspective: 0.003,
              diameterRatio: 1.35,
              physics: const FixedExtentScrollPhysics(),
              onSelectedItemChanged: onSelectedItemChanged,
              childDelegate: ListWheelChildBuilderDelegate(
                childCount: itemCount,
                builder: (context, index) {
                  if (index < 0 || index >= itemCount) return null;
                  return Center(
                    child: Text(
                      itemLabelBuilder(index),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: widget.accentColor,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final maxMonth = _maxAllowedMonth(_selectedYear);
    final maxDays = _daysInMonth(_selectedYear, _selectedMonth);
    final formattedPreview =
        DateFormat('EEEE, d MMMM yyyy').format(_currentSelectedDate);

    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: widget.accentColor.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.cake_rounded,
                    color: widget.accentColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your Birthday',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 23,
                          fontWeight: FontWeight.bold,
                          color: widget.accentColor,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Celebrate with us! Enjoy special birthday treats during your birthday month.',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          height: 1.3,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: () => Navigator.pop(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: widget.accentColor.withValues(alpha: 0.18),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.auto_awesome_rounded,
                    size: 18,
                    color: widget.accentColor,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      formattedPreview,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: widget.accentColor,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F9FA),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned(
                    left: 6,
                    right: 6,
                    top: 22 + 57, // label offset + center of 156px wheel
                    child: IgnorePointer(
                      child: Container(
                        height: 42,
                        decoration: BoxDecoration(
                          color: widget.accentColor.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: widget.accentColor.withValues(alpha: 0.25),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      _buildWheelColumn(
                        label: 'Day',
                        flex: 2,
                        controller: _dayController,
                        itemCount: maxDays,
                        itemLabelBuilder: (index) =>
                            (index + 1).toString().padLeft(2, '0'),
                        onSelectedItemChanged: (index) {
                          setState(() {
                            _selectedDay = index + 1;
                          });
                        },
                      ),
                      _buildWheelColumn(
                        label: 'Month',
                        flex: 4,
                        controller: _monthController,
                        itemCount: maxMonth,
                        itemLabelBuilder: (index) => _monthNames[index],
                        onSelectedItemChanged: (index) {
                          setState(() {
                            _selectedMonth = index + 1;
                            _clampDateIfNeeded();
                          });
                        },
                      ),
                      _buildWheelColumn(
                        label: 'Year',
                        flex: 3,
                        controller: _yearController,
                        itemCount: _years.length,
                        itemLabelBuilder: (index) => _years[index].toString(),
                        onSelectedItemChanged: (index) {
                          setState(() {
                            _selectedYear = _years[index];
                            _clampDateIfNeeded();
                          });
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.grey.shade100,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Cancel',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () =>
                        Navigator.pop(context, _currentSelectedDate),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: widget.accentColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Save Birthday',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
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
    final accentColor = AppColors.deepTeal;
    return Dialog(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(28),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    Icons.mark_email_unread_outlined,
                    color: accentColor,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Change Email',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 23,
                          fontWeight: FontWeight.bold,
                          color: accentColor,
                          height: 1.15,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'We will send a 6-digit verification code to confirm your new email address.',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          height: 1.3,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: () => Navigator.pop(context),
                  borderRadius: BorderRadius.circular(20),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Text(
              'New Email Address',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _emailController,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              autofocus: true,
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
              decoration: InputDecoration(
                hintText: 'name@example.com',
                hintStyle: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  fontWeight: FontWeight.w400,
                  color: Colors.black38,
                ),
                prefixIcon: Icon(
                  Icons.alternate_email_rounded,
                  size: 20,
                  color: accentColor,
                ),
                filled: true,
                fillColor: const Color(0xFFF7F9F9),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide:
                      BorderSide(color: Colors.grey.shade200, width: 1.2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(color: accentColor, width: 1.8),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.grey.shade100,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Cancel',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: ElevatedButton(
                    onPressed: () =>
                        Navigator.pop(context, _emailController.text.trim()),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Send Code',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
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
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 24),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Verify New Email',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 26,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Enter the 6-digit code sent to $_maskedEmail. It expires in $minutes minutes.',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 16,
                height: 1.3,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 24),
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
                            width: 42,
                            height: 54,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF7F9F9),
                              borderRadius: BorderRadius.circular(14),
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
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(
                      backgroundColor: Colors.grey.shade100,
                      foregroundColor: Colors.black87,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Cancel',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: code.length == 6 ? _submit : null,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.deepTeal,
                      disabledBackgroundColor:
                          AppColors.deepTeal.withValues(alpha: 0.25),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: const Text(
                      'Verify Email',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
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
