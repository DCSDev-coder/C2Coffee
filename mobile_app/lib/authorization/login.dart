import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

import 'signup1.dart';
import 'allowed_countries.dart';
import 'auth_transition.dart';
import 'otp_verification.dart';
import '../services/auth_api_service.dart';
import '../services/user_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

// Aliases for compatibility
typedef LoginBackup = LoginPage;

enum _LoginErrorField { phone }

class _LoginPageState extends State<LoginPage>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _phoneController = TextEditingController();
  final FocusNode _phoneFocusNode = FocusNode();
  late final AnimationController _shakeController;
  bool _isPhoneValid = false;
  String _fullPhoneNumber = '';
  final Set<_LoginErrorField> _errorFields = <_LoginErrorField>{};

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _phoneController.addListener(_onFieldChanged);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(const AssetImage('assets/images/FKP01925.jpg'), context);
    precacheImage(const AssetImage('assets/images/c2_logo.png'), context);
  }

  void _onFieldChanged() {
    if (_errorFields.isNotEmpty) {
      setState(() {
        _errorFields.clear();
      });
      _shakeController.stop();
      _shakeController.value = 0;
      return;
    }

    setState(() {});
  }

  @override
  void dispose() {
    _phoneController.removeListener(_onFieldChanged);
    _phoneController.dispose();
    _phoneFocusNode.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  void _markLoginError() {
    setState(() {
      _errorFields
        ..clear()
        ..add(_LoginErrorField.phone);
    });
    _shakeController.forward(from: 0);
  }

  void _showError(String message) {
    showAuthErrorBanner(context, message);
  }

  Widget _buildMainAvatar({required bool compact}) {
    return Image.asset(
      'assets/images/c2_logo.png',
      width: compact ? 180 : 240,
      fit: BoxFit.contain,
    );
  }

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFF1F3A34);
    final mediaQuery = MediaQuery.of(context);
    final keyboardInset = mediaQuery.viewInsets.bottom;
    final keyboardTravel = (mediaQuery.size.height * 0.38).clamp(240.0, 340.0);
    final keyboardProgress =
        (keyboardInset / keyboardTravel).clamp(0.0, 1.0).toDouble();
    final isKeyboardOpen = keyboardProgress > 0.0;
    final sheetBottom = keyboardInset;
    final loginCardHeight = lerpDouble(280.0, 220.0, keyboardProgress) ?? 280.0;
    final avatarTop = lerpDouble(150.0, 110.0, keyboardProgress) ?? 150.0;
    final logoWidth = lerpDouble(240.0, 180.0, keyboardProgress) ?? 240.0;
    final titleTop = avatarTop + (logoWidth * 0.85);
    final subtitleBottom = sheetBottom +
        loginCardHeight +
        (lerpDouble(32.0, 18.0, keyboardProgress) ?? 18.0);
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
        backgroundColor: orangeColor,
        body: GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: () => FocusScope.of(context).unfocus(),
          child: Stack(
            children: [
              Positioned.fill(
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
              if (keyboardBackdropHeight > 0)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: keyboardBackdropHeight,
                  child: const ColoredBox(color: Colors.white),
                ),
              Positioned(
                left: 0,
                right: 0,
                top: avatarTop,
                child: Center(
                  child: SizedBox(
                    width: logoWidth,
                    child: _buildMainAvatar(compact: isKeyboardOpen),
                  ),
                ),
              ),
              Positioned(
                left: 24,
                right: 24,
                top: titleTop,
                child: const Text(
                  'Welcome Back',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
              Positioned(
                left: 32,
                right: 32,
                bottom: subtitleBottom,
                child: const Text(
                  'Log in to continue your coffee journey and enjoy exclusive rewards.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: sheetBottom,
                height: loginCardHeight,
                child: AuthCardEntrance(
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
                            _buildFieldShake(
                              field: _LoginErrorField.phone,
                              child: _buildPhoneField(
                                hasError: _errorFields.contains(
                                  _LoginErrorField.phone,
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            Center(
                              child: GestureDetector(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    buildAuthRoute(const Signup1()),
                                  );
                                },
                                child: RichText(
                                  text: const TextSpan(
                                    style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 14,
                                        color: Colors.black87),
                                    children: [
                                      TextSpan(text: 'New member? '),
                                      TextSpan(
                                        text: 'Join now',
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
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: () async {
                                  if (_fullPhoneNumber.isEmpty ||
                                      !_isPhoneValid) {
                                    _markLoginError();
                                    _showError(
                                      'Please enter a valid phone number before continuing.',
                                    );
                                    return;
                                  }

                                  await UserService.saveUserProfile({
                                    'phone': _fullPhoneNumber,
                                  });

                                  try {
                                    final deviceFingerprint =
                                        await AuthApiService.instance
                                            .getOrCreateDeviceFingerprint();
                                    final otpRequest = await AuthApiService
                                        .instance
                                        .requestOtp(
                                      phone: _fullPhoneNumber,
                                      deviceFingerprint: deviceFingerprint,
                                    );

                                    if (!context.mounted) return;
                                    Navigator.push(
                                      context,
                                      buildAuthRoute(
                                        OtpVerificationPage(
                                          phone: _fullPhoneNumber,
                                          requestId: otpRequest.requestId,
                                          deviceFingerprint: deviceFingerprint,
                                          debugOtpCode: otpRequest.debugOtpCode,
                                          expiresInSeconds:
                                              otpRequest.expiresInSeconds,
                                          resendInSeconds:
                                              otpRequest.resendInSeconds,
                                        ),
                                      ),
                                    );
                                  } on ApiException catch (error) {
                                    if (!context.mounted) return;
                                    _markLoginError();
                                    _showError(
                                      friendlyAuthErrorMessage(
                                        error,
                                        fallback:
                                            'Unable to request OTP right now.',
                                      ),
                                    );
                                  } catch (_) {
                                    if (!context.mounted) return;
                                    _markLoginError();
                                    _showError(
                                        'Unable to request OTP right now.');
                                  }
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: orangeColor,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
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
      ),
    );
  }

  Widget _buildPhoneField({bool hasError = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Phone Number',
          style: TextStyle(
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
            border: Border.all(
              color: hasError ? Colors.redAccent : Colors.transparent,
              width: hasError ? 1.8 : 0,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.grey.withValues(alpha: 0.18),
                blurRadius: 12,
                spreadRadius: 1,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: IntlPhoneField(
            controller: _phoneController,
            focusNode: _phoneFocusNode,
            initialCountryCode: 'MY',
            countries: authCountries,
            disableLengthCheck: true,
            showDropdownIcon: false,
            dropdownIconPosition: IconPosition.trailing,
            flagsButtonMargin: const EdgeInsets.only(left: 12, right: 4),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              hintText: '1234567890',
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
                borderSide: BorderSide(
                  color: hasError ? Colors.redAccent : const Color(0xFF2E5E58),
                  width: 1.5,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Colors.redAccent, width: 1.8),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(20),
                borderSide:
                    const BorderSide(color: Colors.redAccent, width: 2.0),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            style: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            dropdownTextStyle: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            autovalidateMode: AutovalidateMode.disabled,
            onChanged: (phone) {
              setState(() {
                _fullPhoneNumber = phone.completeNumber.trim();
                try {
                  _isPhoneValid = phone.isValidNumber();
                } catch (_) {
                  _isPhoneValid = phone.number.trim().length >= 7;
                }
              });
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFieldShake({
    required _LoginErrorField field,
    required Widget child,
  }) {
    if (!_errorFields.contains(field)) {
      return child;
    }

    return AnimatedBuilder(
      animation: _shakeController,
      child: child,
      builder: (context, child) {
        final progress = _shakeController.value;
        final offsetX = math.sin(progress * math.pi * 6) * (1 - progress) * 10;
        return Transform.translate(
          offset: Offset(offsetX, 0),
          child: child,
        );
      },
    );
  }
}
