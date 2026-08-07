import 'dart:io';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import '../screens/home_page.dart';
import 'auth_transition.dart';
import '../services/auth_api_service.dart';
import '../services/secure_session_service.dart';
import '../services/user_service.dart';

class OtpVerificationPage extends StatefulWidget {
  final String phone;
  final String requestId;
  final String deviceFingerprint;
  final String? debugOtpCode;
  final bool bypassVerification;
  final bool isSignup;
  final Map<String, String>? signupProfile;
  final File? initialPickedImage;
  final String? initialPresetPath;
  final int initialAvatarIndex;

  const OtpVerificationPage({
    super.key,
    required this.phone,
    required this.requestId,
    required this.deviceFingerprint,
    this.debugOtpCode,
    this.bypassVerification = false,
    this.isSignup = false,
    this.signupProfile,
    this.initialPickedImage,
    this.initialPresetPath,
    this.initialAvatarIndex = 0,
  });

  @override
  State<OtpVerificationPage> createState() => _OtpVerificationPageState();
}

// Alias for convenience
typedef OtpVerification = OtpVerificationPage;
typedef OtpBackup = OtpVerificationPage;

class _OtpVerificationPageState extends State<OtpVerificationPage> {
  File? _pickedImage;
  String? _presetAvatarPath = 'assets/images/dato.png';
  int _selectedAvatarIndex = 0;

  final List<TextEditingController> _otpControllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  Timer? _timer;
  int _start = 45;
  bool _isResendEnabled = false;
  bool _isSubmitting = false;
  late String _requestId;
  String? _debugOtpCode;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialPickedImage != null) {
      _pickedImage = widget.initialPickedImage;
      _presetAvatarPath = null;
      _selectedAvatarIndex = -1;
    } else if (widget.initialPresetPath != null) {
      _presetAvatarPath = widget.initialPresetPath;
      _selectedAvatarIndex = widget.initialAvatarIndex;
    }

    _requestId = widget.requestId;
    _debugOtpCode = widget.debugOtpCode;
    startTimer();
    for (int i = 0; i < 6; i++) {
      _otpControllers[i].addListener(() {
        if (_otpControllers[i].text.length == 1 && i < 5) {
          _otpFocusNodes[i + 1].requestFocus();
        }
      });
    }
    if (_debugOtpCode != null && _debugOtpCode!.length == 6) {
      _fillOtpCode(_debugOtpCode!);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(const AssetImage('assets/images/FKP01925.jpg'), context);
    precacheImage(const AssetImage('assets/images/dato.png'), context);
    precacheImage(const AssetImage('assets/images/datin.png'), context);
  }

  void startTimer() {
    _timer?.cancel();
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

  void _fillOtpCode(String otp) {
    for (int i = 0; i < _otpControllers.length && i < otp.length; i++) {
      _otpControllers[i].text = otp[i];
    }
  }

  void _clearOtpCode() {
    for (final controller in _otpControllers) {
      controller.clear();
    }
    if (_otpFocusNodes.isNotEmpty) {
      _otpFocusNodes.first.requestFocus();
    }
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

  Future<void> _completeLocalVerification() async {
    if (!mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      AuthPageRoute(
        page: HomePage(
          initialPickedImage: widget.initialPickedImage,
          initialPresetPath: widget.initialPresetPath,
          initialAvatarIndex: widget.initialAvatarIndex,
        ),
      ),
      (route) => false,
    );
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

  Future<void> _verifyOTP() async {
    String otp = '';
    for (var controller in _otpControllers) {
      otp += controller.text;
    }

    if (otp.length != 6) {
      _showError('Please enter all 6 digits');
      return;
    }

    if (widget.bypassVerification) {
      await _completeLocalVerification();
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final result = await AuthApiService.instance.verifyOtp(
        requestId: _requestId,
        phone: widget.phone,
        otpCode: otp,
        deviceFingerprint: widget.deviceFingerprint,
      );

      if (widget.isSignup && widget.signupProfile != null) {
        await AuthApiService.instance.updateProfile(
          accessToken: result.accessToken,
          profile: widget.signupProfile!,
        );
      }

      await SecureSessionService.instance.saveSession(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      );

      await UserService.saveUserProfile({
        'phone': result.user.phone,
        'username': widget.signupProfile?['display_name'] ?? result.user.displayName,
        if (widget.signupProfile?['email'] != null)
          'email': widget.signupProfile!['email']!,
        if (widget.signupProfile?['gender'] != null)
          'gender': widget.signupProfile!['gender']!,
      });

      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        AuthPageRoute(
          page: HomePage(
            initialPickedImage: widget.initialPickedImage,
            initialPresetPath: widget.initialPresetPath,
            initialAvatarIndex: widget.initialAvatarIndex,
          ),
        ),
        (route) => false,
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      _showError(error.message);
    } catch (_) {
      if (!mounted) return;
      _showError('Unable to verify OTP right now.');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  Future<void> _handleResendOtp() async {
    if (widget.bypassVerification) {
      _clearOtpCode();
      startTimer();
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final otpRequest = await AuthApiService.instance.requestOtp(
        phone: widget.phone,
        deviceFingerprint: widget.deviceFingerprint,
      );

      if (!mounted) return;
      setState(() {
        _requestId = otpRequest.requestId;
        _debugOtpCode = otpRequest.debugOtpCode;
      });
      _clearOtpCode();
      if (_debugOtpCode != null && _debugOtpCode!.length == 6) {
        _fillOtpCode(_debugOtpCode!);
      }
      startTimer();
    } on ApiException catch (error) {
      if (!mounted) return;
      _showError(error.message);
    } catch (_) {
      if (!mounted) return;
      _showError('Unable to resend OTP right now.');
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFF1F3A34);

    return Scaffold(
      backgroundColor: orangeColor,
      body: Stack(
        children: [
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  child: Column(
                    children: [
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
                                    size: 18, color: Color(0xFF1F3A34)),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Spacer to match the "Step 1 of 2" line height in Signup1 (22px) for exact vertical symmetry
                      const SizedBox(height: 22),
                      const Text(
                        'Verify Your Identity',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'We\'ve sent a text to your phone number.\nPlease fill in the security code',
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
                  child: Container(
                    width: double.infinity,
                    clipBehavior: Clip.antiAlias,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius:
                          BorderRadius.vertical(top: Radius.circular(40)),
                    ),
                    child: SingleChildScrollView(
                      physics: const ClampingScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const Text(
                            'Please fill in the security code.',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.normal,
                                color: Color(0xFF1F3A34)),
                          ),
                          const SizedBox(height: 30),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: List.generate(6, (index) {
                              return Container(
                                width: 50,
                                height: 60,
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                      color: orangeColor, width: 1.5),
                                ),
                                child: Center(
                                  child: SizedBox(
                                    width: 58,
                                    child: TextFormField(
                                      controller: _otpControllers[index],
                                      focusNode: _otpFocusNodes[index],
                                      textAlign: TextAlign.center,
                                      textAlignVertical:
                                          TextAlignVertical.center,
                                      keyboardType: TextInputType.number,
                                      maxLength: 1,
                                      style: const TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 26,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.black87),
                                      decoration: const InputDecoration(
                                        counterText: '',
                                        border: InputBorder.none,
                                        isDense: true,
                                        contentPadding:
                                            EdgeInsets.symmetric(vertical: 0),
                                      ),
                                      onChanged: (value) {
                                        if (value.isNotEmpty && index < 5) {
                                          _otpFocusNodes[index + 1]
                                              .requestFocus();
                                        }
                                      },
                                    ),
                                  ),
                                ),
                              );
                            }),
                          ),
                          const SizedBox(height: 24),
                          RichText(
                            textAlign: TextAlign.center,
                            text: TextSpan(
                              style: const TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: Colors.black54),
                              children: [
                                const TextSpan(
                                    text: 'Didn\'t receive the code?\n'),
                                if (_isResendEnabled)
                                  WidgetSpan(
                                    child: GestureDetector(
                                      onTap: _isSubmitting
                                          ? null
                                          : () => _handleResendOtp(),
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
                                    style:
                                        TextStyle(color: Colors.grey.shade500),
                                  ),
                              ],
                            ),
                          ),
                          if (widget.bypassVerification) ...[
                            const SizedBox(height: 12),
                            const Text(
                              'Demo mode: enter any 6 digits.',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1F3A34),
                              ),
                            ),
                          ] else if (_debugOtpCode != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              'Dev OTP: $_debugOtpCode',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1F3A34),
                              ),
                            ),
                          ],
                          const SizedBox(height: 32),
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _isSubmitting ? null : _verifyOTP,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: orangeColor,
                                disabledBackgroundColor: Colors.grey.shade400,
                                foregroundColor: Colors.white,
                                disabledForegroundColor: Colors.white70,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(30)),
                              ),
                              child: _isSubmitting
                                  ? const SizedBox(
                                      width: 22,
                                      height: 22,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                        valueColor:
                                            AlwaysStoppedAnimation<Color>(
                                          Colors.white,
                                        ),
                                      ),
                                    )
                                  : const Text(
                                      'VERIFY',
                                      style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 1.0),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
