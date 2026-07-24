import 'dart:async';
import 'package:flutter/material.dart';

class OtpScreen extends StatefulWidget {
  final String phoneNumber;
  
  const OtpScreen({
    Key? key,
    this.phoneNumber = '+60 11 2233 4455', // Default placeholder
  }) : super(key: key);

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final List<TextEditingController> _controllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  
  int _secondsRemaining = 45;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _startTimer() {
    _secondsRemaining = 45;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsRemaining > 0) {
        setState(() {
          _secondsRemaining--;
        });
      } else {
        timer.cancel();
      }
    });
  }

  void _resendCode() {
    if (_secondsRemaining == 0) {
      // Trigger resend API logic here
      _startTimer();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OTP resent successfully!')),
      );
    }
  }

  void _verifyOtp() {
    String otp = _controllers.map((c) => c.text).join();
    if (otp.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter the 6-digit code.')),
      );
      return;
    }
    // Navigate to home
    Navigator.pushNamedAndRemoveUntil(context, '/home', (route) => false);
  }

  void _onOtpChanged(String value, int index) {
    if (value.isNotEmpty) {
      if (index < 5) {
        _focusNodes[index + 1].requestFocus();
      } else {
        _focusNodes[index].unfocus();
        // optionally auto-submit: _verifyOtp();
      }
    } else if (value.isEmpty && index > 0) {
      // Handle backspace logic slightly differently in Flutter if needed, 
      // but typical on-change for empty goes back.
      _focusNodes[index - 1].requestFocus();
    }
  }

  @override
  Widget build(BuildContext context) {
    String minutes = (_secondsRemaining ~/ 60).toString().padLeft(2, '0');
    String seconds = (_secondsRemaining % 60).toString().padLeft(2, '0');

    return Scaffold(
      backgroundColor: const Color(0xFFE56000), // Orange background
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // Orange Header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.only(top: 44, bottom: 36, left: 28, right: 28),
              constraints: const BoxConstraints(minHeight: 240),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    'Verify Your Identity',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Playfair Display',
                      fontSize: 48,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      height: 1.05,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: TextStyle(
                        fontFamily: 'DM Sans',
                        fontSize: 13,
                        fontWeight: FontWeight.w400,
                        color: Colors.white.withOpacity(0.82),
                        height: 1.45,
                      ),
                      children: [
                        const TextSpan(text: "We've sent an SMS to "),
                        TextSpan(
                          text: widget.phoneNumber,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const TextSpan(text: '.'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // White Card
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.only(top: 36, left: 24, right: 24, bottom: 28),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(30),
                    topRight: Radius.circular(30),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0x14000000), // rgba(0,0,0,0.08)
                      offset: Offset(0, -4),
                      blurRadius: 20,
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    const Text(
                      'Please fill in the security code.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFE56000),
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    // OTP Boxes
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(6, (index) {
                        return Container(
                          width: 44,
                          height: 54,
                          margin: EdgeInsets.only(right: index == 5 ? 0 : 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x0A000000),
                                offset: Offset(0, 2),
                                blurRadius: 8,
                              )
                            ],
                          ),
                          child: TextField(
                            controller: _controllers[index],
                            focusNode: _focusNodes[index],
                            keyboardType: TextInputType.number,
                            textAlign: TextAlign.center,
                            maxLength: 1,
                            style: const TextStyle(
                              fontFamily: 'DM Sans',
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1C3B24),
                            ),
                            cursorColor: const Color(0xFFE56000),
                            decoration: InputDecoration(
                              counterText: '',
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE6DCD3), width: 1.5),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE6DCD3), width: 1.5),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE56000), width: 1.5),
                              ),
                            ),
                            onChanged: (value) => _onOtpChanged(value, index),
                          ),
                        );
                      }),
                    ),
                    const SizedBox(height: 24),
                    
                    // Resend
                    Column(
                      children: [
                        const Text(
                          "Didn't receive the code?",
                          style: TextStyle(
                            fontFamily: 'DM Sans',
                            fontSize: 13,
                            color: Color(0xFF4A3A2F),
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        GestureDetector(
                          onTap: _resendCode,
                          child: Text(
                            'Resend Code ${_secondsRemaining > 0 ? "($minutes:$seconds)" : ""}',
                            style: TextStyle(
                              fontFamily: 'DM Sans',
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _secondsRemaining > 0 ? const Color(0xFFE56000).withOpacity(0.5) : const Color(0xFFE56000),
                              decoration: _secondsRemaining == 0 ? TextDecoration.underline : TextDecoration.none,
                              decorationColor: const Color(0xFFE56000),
                            ),
                          ),
                        ),
                      ],
                    ),
                    
                    const Spacer(),
                    
                    // VERIFY button
                    SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _verifyOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFE56000),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25),
                          ),
                          elevation: 0,
                          shadowColor: Colors.transparent,
                        ).copyWith(
                          elevation: MaterialStateProperty.all(0),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(25),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x59E56000), // rgba(229, 96, 0, 0.35)
                                offset: Offset(0, 6),
                                blurRadius: 18,
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'VERIFY',
                            style: TextStyle(
                              fontFamily: 'Playfair Display',
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              letterSpacing: 2,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
