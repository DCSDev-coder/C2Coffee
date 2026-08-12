import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

import 'login.dart';
import 'auth_transition.dart';
import 'otp_verification.dart';
import '../services/auth_api_service.dart';
import '../services/user_service.dart';

class Signup2 extends StatefulWidget {
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const Signup2({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<Signup2> createState() => _Signup2State();
}

// Aliases for compatibility
typedef Signup2Backup = Signup2;

class _Signup2State extends State<Signup2> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _houseController = TextEditingController();
  final TextEditingController _streetController = TextEditingController();
  final TextEditingController _postcodeController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _stateController = TextEditingController();
  final TextEditingController _referralCodeController = TextEditingController();

  String? _selectedGender;
  bool _agreedToTerms = false;

  // Avatar State
  File? _pickedImage;
  String? _presetAvatarPath = 'assets/images/dato.png';
  int _selectedAvatarIndex = 0;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    _cityController.text = 'Semenyih';
    _stateController.text = 'Selangor';
    _houseController.addListener(_onFieldChanged);
    _streetController.addListener(_onFieldChanged);
    _postcodeController.addListener(_onFieldChanged);
    _cityController.addListener(_onFieldChanged);
    _stateController.addListener(_onFieldChanged);
    _referralCodeController.addListener(_onFieldChanged);

    if (widget.initialPickedImage != null) {
      _pickedImage = widget.initialPickedImage;
      _presetAvatarPath = null;
      _selectedAvatarIndex = -1;
    } else if (widget.initialPresetPath != null) {
      _presetAvatarPath = widget.initialPresetPath;
      _pickedImage = null;
      _selectedAvatarIndex = widget.initialAvatarIndex;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(const AssetImage('assets/images/FKP01925.jpg'), context);
    precacheImage(const AssetImage('assets/images/dato.png'), context);
    precacheImage(const AssetImage('assets/images/datin.png'), context);
  }

  void _onFieldChanged() => setState(() {});

  @override
  void dispose() {
    _houseController.removeListener(_onFieldChanged);
    _streetController.removeListener(_onFieldChanged);
    _postcodeController.removeListener(_onFieldChanged);
    _cityController.removeListener(_onFieldChanged);
    _stateController.removeListener(_onFieldChanged);
    _referralCodeController.removeListener(_onFieldChanged);
    _houseController.dispose();
    _streetController.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  bool get _isFormValid {
    return _houseController.text.trim().isNotEmpty &&
        _streetController.text.trim().isNotEmpty &&
        _postcodeController.text.trim().isNotEmpty &&
        _cityController.text.trim().isNotEmpty &&
        _stateController.text.trim().isNotEmpty &&
        _selectedGender != null &&
        _agreedToTerms;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _pickImageFromGallery() async {
    final picker = ImagePicker();
    final XFile? image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _pickedImage = File(image.path);
        _presetAvatarPath = null;
        _selectedAvatarIndex = -1;
      });
    }
  }

  void _showAvatarPicker() {
    showDialog(
      context: context,
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.6),
      builder: (BuildContext context) {
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Container(
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFFFAF4EE), Colors.white],
              ),
              borderRadius: BorderRadius.circular(24),
              boxShadow: const [
                BoxShadow(
                    color: Color(0x3D000000),
                    blurRadius: 30,
                    offset: Offset(0, 10)),
                BoxShadow(
                    color: Color(0x1A000000),
                    blurRadius: 10,
                    offset: Offset(0, 4)),
              ],
              border: Border.all(
                  color: const Color(0xFF1F3A34).withValues(alpha: 0.2),
                  width: 1),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: Alignment.topRight,
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1F3A34).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: const Color(0xFF1F3A34)
                                  .withValues(alpha: 0.2),
                              width: 1),
                        ),
                        child: const Icon(Icons.close,
                            color: Color(0xFF1F3A34), size: 18),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Choose Your Icon',
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1F3A34),
                        letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                            color: Colors.grey.withValues(alpha: 0.08),
                            blurRadius: 8,
                            offset: const Offset(0, 2))
                      ],
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children:
                              List.generate(_avatarOptions.length, (index) {
                            final isSelected = _selectedAvatarIndex == index &&
                                _pickedImage == null;
                            return GestureDetector(
                              onTap: () {
                                setState(() {
                                  _selectedAvatarIndex = index;
                                  _pickedImage = null;
                                  _presetAvatarPath =
                                      _avatarOptions[index]['path'];
                                });
                                Navigator.pop(context);
                              },
                              child: Container(
                                margin:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: isSelected
                                        ? const Color(0xFF1F3A34)
                                        : Colors.grey.shade300,
                                    width: isSelected ? 3 : 2,
                                  ),
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                              color: const Color(0xFF1F3A34)
                                                  .withValues(alpha: 0.3),
                                              blurRadius: 8,
                                              offset: const Offset(0, 2))
                                        ]
                                      : [],
                                ),
                                child: CircleAvatar(
                                  radius: 40,
                                  backgroundColor: const Color(0xFF1F3A34),
                                  backgroundImage:
                                      AssetImage(_avatarOptions[index]['path']),
                                ),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                                child: Container(
                                    height: 1, color: Colors.grey.shade300)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 16),
                              child: Text('or',
                                  style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 14,
                                      color: const Color(0xFF1F3A34),
                                      fontWeight: FontWeight.w600)),
                            ),
                            Expanded(
                                child: Container(
                                    height: 1, color: Colors.grey.shade300)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        GestureDetector(
                          onTap: () {
                            Navigator.pop(context);
                            _pickImageFromGallery();
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(colors: [
                                Color(0xFF1F3A34),
                                Color(0xFF1F3A34)
                              ]),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                    color: const Color(0xFF1F3A34)
                                        .withValues(alpha: 0.3),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4))
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                Icon(Icons.upload_file_outlined,
                                    color: Colors.white, size: 20),
                                SizedBox(width: 10),
                                Text(
                                  'Upload from your own gallery',
                                  style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 16,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white,
                                      letterSpacing: 0.3),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: TextButton(
                      onPressed: () => Navigator.pop(context),
                      style: TextButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                        side:
                            BorderSide(color: Colors.grey.shade300, width: 1.5),
                      ),
                      child: const Text('Cancel',
                          style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Colors.grey,
                              letterSpacing: 1.2)),
                    ),
                  ),
                  const SizedBox(height: 4),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildMainAvatar() {
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

    return Container(
      width: 100,
      height: 100,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFF1F3A34),
      ),
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3.0),
        ),
        child: ClipOval(child: Image(image: imageProvider, fit: BoxFit.cover)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFF1F3A34);
    final mediaQuery = MediaQuery.of(context);
    final keyboardInset = mediaQuery.viewInsets.bottom;
    final cardBottomInset = keyboardInset > 0 ? keyboardInset : 0.0;
    final keyboardBackdropHeight = keyboardInset > 0
        ? keyboardInset + mediaQuery.padding.bottom + 24
        : 0.0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: Colors.white,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        resizeToAvoidBottomInset: false,
        backgroundColor: const Color(0xFF1F3A34),
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusScope.of(context).unfocus(),
          child: Stack(
            children: [
              if (keyboardBackdropHeight > 0)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: keyboardBackdropHeight,
                  child: const ColoredBox(color: Colors.white),
                ),
              // Header Background Picture
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 320,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      'assets/images/FKP01925.jpg',
                      fit: BoxFit.cover,
                      alignment: Alignment.center,
                    ),
                    Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            const Color(0xFF1F3A34).withValues(alpha: 0.65),
                            const Color(0xFF1F3A34).withValues(alpha: 0.90),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SafeArea(
                bottom: false,
                child: Column(
                  children: [
                    // Top Section
                    Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 24, vertical: 12),
                      child: Column(
                        children: [
                          Align(
                            alignment: Alignment.centerLeft,
                            child: IconButton(
                              onPressed: () => Navigator.maybePop(context),
                              icon: const Icon(
                                Icons.arrow_back_ios_new_rounded,
                                color: Colors.white,
                                size: 20,
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: _showAvatarPicker,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                _buildMainAvatar(),
                                Positioned(
                                  right: 2,
                                  bottom: 2,
                                  child: Container(
                                    padding: const EdgeInsets.all(6),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: const Color(0xFFFAF4EE),
                                          width: 2),
                                      boxShadow: const [
                                        BoxShadow(
                                            color: Color(0x1A000000),
                                            blurRadius: 4)
                                      ],
                                    ),
                                    child: const Icon(Icons.camera_alt,
                                        size: 18, color: Color(0xFF1F3A34)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Step 2 of 2',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 20,
                                fontStyle: FontStyle.italic,
                                color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Refine Your Profile',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 26,
                                fontWeight: FontWeight.bold,
                                color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Complete your setup for exclusive member privileges.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12,
                                color: Colors.white70),
                          ),
                        ],
                      ),
                    ),

                    // White Card Section
                    Expanded(
                      child: AnimatedPadding(
                        duration: const Duration(milliseconds: 220),
                        curve: Curves.easeOutCubic,
                        padding: EdgeInsets.only(bottom: cardBottomInset),
                        child: Container(
                          width: double.infinity,
                          clipBehavior: Clip.antiAlias,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            borderRadius:
                                BorderRadius.vertical(top: Radius.circular(40)),
                          ),
                          child: SingleChildScrollView(
                            keyboardDismissBehavior:
                                ScrollViewKeyboardDismissBehavior.onDrag,
                            physics: const ClampingScrollPhysics(),
                            padding: EdgeInsets.fromLTRB(
                              24,
                              16,
                              24,
                              20 + mediaQuery.padding.bottom,
                            ),
                            child: Form(
                              key: _formKey,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Address Header
                                  const Text(
                                    'Address',
                                    style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF2E5E58)),
                                  ),
                                  const SizedBox(height: 6),
                                  _buildTextField(
                                    label: 'Unit / House No.',
                                    hintText:
                                        'e.g. A-12-03, Residensi Eco Forest',
                                    controller: _houseController,
                                  ),
                                  const SizedBox(height: 10),
                                  _buildTextField(
                                    label: 'Street Name / Residential Area',
                                    hintText: 'e.g. Jalan Eco Forest 1',
                                    controller: _streetController,
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    children: [
                                      Expanded(
                                        flex: 4,
                                        child: _buildTextField(
                                          label: 'Postcode',
                                          hintText: '43500',
                                          controller: _postcodeController,
                                          keyboardType: TextInputType.number,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        flex: 6,
                                        child: _buildTextField(
                                          label: 'City',
                                          hintText: 'Semenyih',
                                          controller: _cityController,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  _buildTextField(
                                    label: 'State',
                                    hintText: 'Selangor',
                                    controller: _stateController,
                                  ),
                                  const SizedBox(height: 10),
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Gender',
                                        style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: orangeColor),
                                      ),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Expanded(
                                              child: _buildGenderButton(
                                                  'Female', Icons.female)),
                                          const SizedBox(width: 12),
                                          Expanded(
                                              child: _buildGenderButton(
                                                  'Male', Icons.male)),
                                        ],
                                      ),
                                    ],
                                  ),

                                  const SizedBox(height: 10),

                                  // Referral Code
                                  _buildTextField(
                                      label:
                                          "Add your friend's referral code (Optional)",
                                      hintText: "e.g. DSC123",
                                      controller: _referralCodeController),

                                  const SizedBox(height: 16),

                                  // Terms & Conditions (I agree)
                                  _buildTermsAndConditions(),

                                  const SizedBox(height: 16),

                                  // Already a member? Login
                                  Center(
                                    child: GestureDetector(
                                      onTap: () {
                                        Navigator.push(
                                          context,
                                          buildAuthRoute(const LoginPage()),
                                        );
                                      },
                                      child: RichText(
                                        text: const TextSpan(
                                          style: TextStyle(
                                              fontFamily: 'Afacad',
                                              fontSize: 14,
                                              color: Colors.black87),
                                          children: [
                                            TextSpan(
                                                text: 'Already a member? '),
                                            TextSpan(
                                              text: 'Login',
                                              style: TextStyle(
                                                  fontFamily: 'Recoleta',
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFF1F3A34)),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 20),

                                  // PREVIOUS STEP BUTTON
                                  SizedBox(
                                    width: double.infinity,
                                    height: 48,
                                    child: ElevatedButton(
                                      onPressed: () => Navigator.pop(context),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.white,
                                        foregroundColor: orangeColor,
                                        elevation: 0,
                                        shadowColor: Colors.transparent,
                                        side: BorderSide(
                                            color: Colors.grey.shade300,
                                            width: 1),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(30)),
                                      ),
                                      child: const Text(
                                        'PREVIOUS STEP',
                                        style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.0),
                                      ),
                                    ),
                                  ),

                                  const SizedBox(height: 10),

                                  // SIGN UP BUTTON
                                  SizedBox(
                                    width: double.infinity,
                                    height: 48,
                                    child: ElevatedButton(
                                      onPressed: _isFormValid
                                          ? () async {
                                              final fullAddress =
                                                  '${_houseController.text.trim()}, ${_streetController.text.trim()}, ${_postcodeController.text.trim()} ${_cityController.text.trim()}, ${_stateController.text.trim()}';
                                              await UserService
                                                  .saveUserProfile({
                                                'gender': _selectedGender ?? '',
                                                'address': fullAddress,
                                                'state': _stateController.text
                                                    .trim(),
                                              });

                                              if (!context.mounted) return;
                                              final profile = await UserService
                                                  .getUserProfile();

                                              final phone =
                                                  profile['phone']?.trim() ??
                                                      '';
                                              if (phone.isEmpty) {
                                                _showError(
                                                    'Phone number is missing. Please restart signup.');
                                                return;
                                              }

                                              try {
                                                final deviceFingerprint =
                                                    await AuthApiService
                                                        .instance
                                                        .getOrCreateDeviceFingerprint();
                                                final otpRequest =
                                                    await AuthApiService
                                                        .instance
                                                        .requestOtp(
                                                  phone: phone,
                                                  deviceFingerprint:
                                                      deviceFingerprint,
                                                );

                                                if (!context.mounted) return;
                                                Navigator.push(
                                                  context,
                                                  buildAuthRoute(
                                                    OtpVerificationPage(
                                                      phone: phone,
                                                      requestId:
                                                          otpRequest.requestId,
                                                      deviceFingerprint:
                                                          deviceFingerprint,
                                                      debugOtpCode: otpRequest
                                                          .debugOtpCode,
                                                      expiresInSeconds:
                                                          otpRequest
                                                              .expiresInSeconds,
                                                      resendInSeconds:
                                                          otpRequest
                                                              .resendInSeconds,
                                                      isSignup: true,
                                                      signupProfile: {
                                                        'display_name': profile[
                                                                'username'] ??
                                                            'C2 Member',
                                                        'email':
                                                            profile['email'] ??
                                                                '',
                                                        'birthday': profile[
                                                                'birthday'] ??
                                                            '',
                                                        'gender':
                                                            _selectedGender ??
                                                                '',
                                                        'house_line':
                                                            _houseController
                                                                .text
                                                                .trim(),
                                                        'street_line':
                                                            _streetController
                                                                .text
                                                                .trim(),
                                                        'postcode':
                                                            _postcodeController
                                                                .text
                                                                .trim(),
                                                        'city': _cityController
                                                            .text
                                                            .trim(),
                                                        'state':
                                                            _stateController
                                                                .text
                                                                .trim(),
                                                      },
                                                      initialPickedImage:
                                                          _pickedImage,
                                                      initialPresetPath:
                                                          _presetAvatarPath,
                                                      initialAvatarIndex:
                                                          _selectedAvatarIndex,
                                                    ),
                                                  ),
                                                );
                                              } on ApiException catch (error) {
                                                if (!context.mounted) return;
                                                _showError(error.message);
                                              } catch (_) {
                                                if (!context.mounted) return;
                                                _showError(
                                                    'Unable to request OTP right now.');
                                              }
                                            }
                                          : null,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: orangeColor,
                                        disabledBackgroundColor:
                                            Colors.grey.shade400,
                                        foregroundColor: Colors.white,
                                        disabledForegroundColor: Colors.white70,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(30)),
                                      ),
                                      child: const Text(
                                        'SIGN UP',
                                        style: TextStyle(
                                            fontFamily: 'Recoleta',
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            letterSpacing: 1.0),
                                      ),
                                    ),
                                  ),

                                  // Bottom padding
                                  SizedBox(
                                      height: 20 +
                                          MediaQuery.of(context)
                                              .padding
                                              .bottom),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required String hintText,
    required TextEditingController controller,
    TextInputType keyboardType = TextInputType.text,
    bool readOnly = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF2E5E58)),
        ),
        const SizedBox(height: 4),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: Colors.grey.withValues(alpha: 0.18),
                blurRadius: 12,
                spreadRadius: 1,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            readOnly: readOnly,
            onTapOutside: (_) => FocusScope.of(context).unfocus(),
            style: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              hintText: hintText,
              hintStyle: const TextStyle(
                  fontFamily: 'Afacad', fontSize: 15, color: Colors.grey),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(20),
                  borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Color(0xFF2E5E58), width: 1.5),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGenderButton(String gender, IconData icon) {
    final bool isSelected = _selectedGender == gender;
    const Color orangeColor = Color(0xFF1F3A34);

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedGender = gender;
        });
      },
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? orangeColor : Colors.grey.shade300,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: orangeColor.withValues(alpha: 0.1),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon,
                size: 18,
                color: isSelected ? orangeColor : Colors.grey.shade400),
            const SizedBox(width: 6),
            Text(
              gender,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: isSelected ? orangeColor : Colors.grey.shade400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showTermsAndConditionsDialog() {
    const Color brandColor = Color(0xFF1F3A34);
    final List<String> terms = [
      'C2 Token is a closed-loop prepaid balance valid exclusively for orders at participating C2 Coffee stores.',
      'C2 Tokens and top-up balances are non-refundable, non-transferable, and cannot be redeemed for cash.',
      'All beverage and food orders placed through the App are strictly for Store Self-Pickup.',
      'Personal data is handled in accordance with the Malaysian Personal Data Protection Act 2010 (PDPA).',
      'Promotional cups, tier rewards, and vouchers are subject to individual validity and redemption criteria.',
      'C2 Coffee reserves the right to amend terms, pricing, and member tiers when necessary.',
    ];

    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          elevation: 8,
          backgroundColor: Colors.white,
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Terms & Conditions',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Color(0xFFEDF4F3),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.close,
                          size: 18,
                          color: brandColor,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const Text(
                  'By proceeding with this, you agree that:',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),
                ...terms.map((term) => Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '• ',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: brandColor,
                            ),
                          ),
                          Expanded(
                            child: Text(
                              term,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13.5,
                                color: Colors.black87,
                                height: 1.3,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: ElevatedButton(
                    onPressed: () {
                      setState(() {
                        _agreedToTerms = true;
                      });
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: brandColor,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25),
                      ),
                    ),
                    child: const Text(
                      'I AGREE',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
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

  Widget _buildTermsAndConditions() {
    const Color brandColor = Color(0xFF1F3A34);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: _agreedToTerms,
            activeColor: brandColor,
            checkColor: Colors.white,
            side: const BorderSide(
              color: Color(0xFF1F3A34),
              width: 1.5,
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
            onChanged: (bool? value) {
              setState(() {
                _agreedToTerms = value ?? false;
              });
            },
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              text: 'I agree to the ',
              style: const TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13.5,
                color: Colors.black87,
              ),
              children: [
                TextSpan(
                  text: 'Terms & Conditions',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: brandColor,
                    decoration: TextDecoration.underline,
                  ),
                  recognizer: TapGestureRecognizer()
                    ..onTap = _showTermsAndConditionsDialog,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
