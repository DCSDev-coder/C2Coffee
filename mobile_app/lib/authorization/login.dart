import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl_phone_field/intl_phone_field.dart';
import 'package:intl_phone_field/countries.dart' as intl_countries;
import 'package:flutter/foundation.dart' show kIsWeb;

import 'signup1.dart';
import 'otp_verification.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();

  // Avatar State
  File? _pickedImage;
  String? _presetAvatarPath = 'assets/images/dato.png';
  int _selectedAvatarIndex = 0;
  bool _isPhoneValid = false;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    _phoneController.addListener(_onFieldChanged);
    _emailController.addListener(_onFieldChanged);
  }

  void _onFieldChanged() => setState(() {});

  @override
  void dispose() {
    _phoneController.removeListener(_onFieldChanged);
    _emailController.removeListener(_onFieldChanged);
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  bool get _isFormValid {
    final phone = _phoneController.text.trim();
    final email = _emailController.text.trim();

    final isPhoneValid = phone.isNotEmpty && _isPhoneValid;
    final isEmailValid = email.isNotEmpty &&
        RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);

    return isPhoneValid || isEmailValid;
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
                  color: const Color(0xFFE76D00).withValues(alpha: 0.2),
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
                          color: const Color(0xFFE76D00).withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                          border: Border.all(
                              color: const Color(0xFFE76D00)
                                  .withValues(alpha: 0.2),
                              width: 1),
                        ),
                        child: const Icon(Icons.close,
                            color: Color(0xFFE76D00), size: 18),
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
                        color: Color(0xFFE76D00),
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
                                        ? const Color(0xFFE76D00)
                                        : Colors.grey.shade300,
                                    width: isSelected ? 3 : 2,
                                  ),
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                              color: const Color(0xFFE76D00)
                                                  .withValues(alpha: 0.3),
                                              blurRadius: 8,
                                              offset: const Offset(0, 2))
                                        ]
                                      : [],
                                ),
                                child: CircleAvatar(
                                  radius: 40,
                                  backgroundColor: const Color(0xFFE76D00),
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
                                      color: const Color(0xFFE76D00),
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
                                Color(0xFFE76D00),
                                Color(0xFFE76D00)
                              ]),
                              borderRadius: BorderRadius.circular(12),
                              boxShadow: [
                                BoxShadow(
                                    color: const Color(0xFFE76D00)
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
      imageProvider = kIsWeb ? NetworkImage(_pickedImage!.path) : FileImage(_pickedImage!) as ImageProvider;
    } else if (_presetAvatarPath != null) {
      imageProvider = AssetImage(_presetAvatarPath!);
    } else {
      imageProvider = const AssetImage('assets/images/dato.png');
    }

    return Container(
      width: 100,
      height: 100,
      decoration:
          const BoxDecoration(shape: BoxShape.circle, color: Color(0xFFE76D00)),
      child: ClipOval(child: Image(image: imageProvider, fit: BoxFit.cover)),
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFFE76D00);

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          image: DecorationImage(
              image: AssetImage('assets/images/background.png'),
              fit: BoxFit.cover),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Avatar
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
                                    color: const Color(0xFFFAF4EE), width: 2),
                                boxShadow: const [
                                  BoxShadow(
                                      color: Color(0x1A000000), blurRadius: 4)
                                ],
                              ),
                              child: const Icon(Icons.camera_alt,
                                  size: 18, color: Color(0xFFE76D00)),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Welcome Back
                    const Text(
                      'Welcome Back',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 32,
                          fontWeight: FontWeight.normal,
                          color: orangeColor),
                    ),

                    const SizedBox(height: 6),

                    const Text(
                      'Log in to continue your coffee journey and enjoy exclusive rewards.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          color: Colors.black87),
                    ),

                    const SizedBox(height: 20),

                    // Phone Number Box
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Phone Number',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 17,
                              fontWeight: FontWeight.bold,
                              color: orangeColor),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: const [
                              BoxShadow(
                                  color: Color(0x08000000),
                                  blurRadius: 6,
                                  offset: Offset(0, 2))
                            ],
                          ),
                          child: IntlPhoneField(
                            controller: _phoneController,
                            initialCountryCode: 'MY',
                            countries: [
                              ...intl_countries.countries.where((c) => c.code == 'MY').map((c) => intl_countries.Country(
                                    name: ' Malaysia',
                                    nameTranslations: {},
                                    flag: c.flag,
                                    code: c.code,
                                    dialCode: c.dialCode,
                                    minLength: c.minLength,
                                    maxLength: c.maxLength,
                                    regionCode: c.regionCode,
                                  )),
                              ...intl_countries.countries.where((c) => c.code == 'SG').map((c) => intl_countries.Country(
                                    name: ' Singapore',
                                    nameTranslations: {},
                                    flag: c.flag,
                                    code: c.code,
                                    dialCode: c.dialCode,
                                    minLength: c.minLength,
                                    maxLength: c.maxLength,
                                    regionCode: c.regionCode,
                                  )),
                              ...intl_countries.countries.where((c) => c.code != 'MY' && c.code != 'SG'),
                            ],
                            disableLengthCheck: true,
                            showDropdownIcon: false,
                            dropdownIconPosition: IconPosition.trailing,
                            flagsButtonMargin:
                                const EdgeInsets.only(left: 12, right: 4),
                            decoration: InputDecoration(
                              hintText: '1234567890',
                              hintStyle: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 15,
                                  color: Colors.grey),
                              border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide.none),
                              enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide.none),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide: const BorderSide(
                                    color: orangeColor, width: 1.5),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 12),
                            ),
                            style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                color: Colors.black87),
                            dropdownTextStyle: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                color: Colors.black87),
                            onChanged: (phone) {
                              setState(() {
                                try {
                                  _isPhoneValid = phone.isValidNumber();
                                } catch (_) {
                                  _isPhoneValid =
                                      phone.number.trim().length >= 7;
                                }
                              });
                            },
                            onCountryChanged: (_) => setState(() {}),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // OR Divider
                    Row(
                      children: [
                        Expanded(
                            child: Container(
                                height: 1, color: Colors.grey.shade400)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text('or',
                              style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: const Color(0xFFE76D00),
                                  fontWeight: FontWeight.w600)),
                        ),
                        Expanded(
                            child: Container(
                                height: 1, color: Colors.grey.shade400)),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Continue with Email Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: () {},
                        icon: const Icon(Icons.email_outlined,
                            size: 20, color: orangeColor),
                        label: const Text(
                          'Continue with Email',
                          style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: orangeColor),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          elevation: 0,
                          shadowColor: Colors.transparent,
                          side:
                              BorderSide(color: Colors.grey.shade300, width: 1),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30)),
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // New member?
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('New member? ',
                            style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                color: Colors.black87)),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (context) => const Signup1()),
                            );
                          },
                          child: const Text('Join now',
                              style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: orangeColor)),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),

                    // LOGIN Button
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _isFormValid
                            ? () {
                                // Pass the current avatar state to the OTP page
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => OtpVerificationPage(
                                      initialPickedImage: _pickedImage,
                                      initialPresetPath: _presetAvatarPath,
                                      initialAvatarIndex: _selectedAvatarIndex,
                                    ),
                                  ),
                                );
                              }
                            : null,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: orangeColor,
                          disabledBackgroundColor: Colors.grey.shade400,
                          foregroundColor: Colors.white,
                          disabledForegroundColor: Colors.white70,
                          elevation: 0,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30)),
                        ),
                        child: const Text(
                          'LOGIN',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1.0),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
