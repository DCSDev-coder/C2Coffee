import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:image_picker/image_picker.dart';
import '../screens/home_page.dart';

class OtpVerificationPage extends StatefulWidget {
  // Add parameters to receive avatar data
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const OtpVerificationPage({
    super.key,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  // Avatar State
  File? _pickedImage;
  String? _presetAvatarPath = 'assets/images/dato.png';
  int _selectedAvatarIndex = 0;

  // OTP State
  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  // Timer State
  Timer? _timer;
  int _start = 45;
  bool _isResendEnabled = false;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    // Load the avatar data passed from the previous screen
    _pickedImage = widget.initialPickedImage;
    _presetAvatarPath = widget.initialPresetPath;
    _selectedAvatarIndex = widget.initialAvatarIndex;

    startTimer();
    // Add listeners to automatically move to next box
    for (int i = 0; i < 6; i++) {
      _otpControllers[i].addListener(() {
        if (_otpControllers[i].text.length == 1 && i < 5) {
          _otpFocusNodes[i + 1].requestFocus();
        }
      });
    }
  }

  void startTimer() {
    _start = 45;
    _isResendEnabled = false;
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_start == 0) {
        setState(() {
          _isResendEnabled = true;
        });
        timer.cancel();
      } else {
        setState(() {
          _start--;
        });
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (var controller in _otpControllers) {
      controller.dispose();
    }
    for (var node in _otpFocusNodes) {
      node.dispose();
    }
    super.dispose();
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

                  const SizedBox(height: 20),

                  // Title
                  const Text(
                    'Verify Your Identity',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 32,
                        fontWeight: FontWeight.normal,
                        color: orangeColor),
                  ),

                  const SizedBox(height: 8),

                  // Subtitle
                  const Text(
                    'We\'ve sent an SMS to your phone number.\nPlease fill in the security code',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 15,
                        color: Colors.black87),
                  ),

                  const SizedBox(height: 30),

                  // OTP Boxes
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: List.generate(6, (index) {
                      return Container(
                        width: 44,
                        height: 60,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: orangeColor, width: 1.5),
                        ),
                        alignment: Alignment.center,
                        child: Center(
                          child: TextFormField(
                            controller: _otpControllers[index],
                            focusNode: _otpFocusNodes[index],
                            textAlign: TextAlign.center,
                            textAlignVertical: TextAlignVertical.center,
                            keyboardType: TextInputType.number,
                            maxLength: 1,
                            style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.black87),
                            decoration: const InputDecoration(
                              counterText: '',
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            onChanged: (value) {
                              if (value.isNotEmpty && index < 5) {
                                _otpFocusNodes[index + 1].requestFocus();
                              }
                            },
                          ),
                        ),
                      );
                    }),
                  ),

                  const SizedBox(height: 24),

                  // Send via Email
                  GestureDetector(
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                            content: Text('OTP sent to your email!'),
                            backgroundColor: orangeColor),
                      );
                      setState(() {
                        startTimer();
                      });
                    },
                    child: const Text(
                      'Or send code via email',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14,
                        color: Color(0xFFE76D00),
                        fontWeight: FontWeight.w600,
                        decoration: TextDecoration.underline,
                        decorationColor: Color(0xFFE76D00),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // Resend Text
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          color: Colors.black54),
                      children: [
                        const TextSpan(text: 'Didn\'t receive the code?\n'),
                        if (_isResendEnabled)
                          WidgetSpan(
                            child: GestureDetector(
                              onTap: () {
                                setState(() {
                                  startTimer();
                                });
                              },
                              child: const Text(
                                'Resend Code',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontWeight: FontWeight.bold,
                                  color: orangeColor,
                                ),
                              ),
                            ),
                          )
                        else
                          TextSpan(
                            text:
                                'Resend Code (00:${_start.toString().padLeft(2, '0')})',
                            style: TextStyle(color: Colors.grey.shade500),
                          ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 30),

                  // VERIFY Button
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('OTP Verified! Welcome back!'),
                              backgroundColor: Color(0xFFE76D00)),
                        );
                        Navigator.pushAndRemoveUntil(
                          context,
                          MaterialPageRoute(
                            builder: (context) => HomePage(
                              initialPickedImage: _pickedImage,
                              initialPresetPath: _presetAvatarPath,
                              initialAvatarIndex: _selectedAvatarIndex,
                            ),
                          ),
                          (route) => false,
                        );
                      },
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
                        'VERIFY',
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
    );
  }
}
