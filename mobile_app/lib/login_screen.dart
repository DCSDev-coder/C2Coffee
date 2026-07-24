import 'package:flutter/material.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String selectedCountryCode = '+60';
  final TextEditingController _phoneController = TextEditingController();

  final List<String> countryCodes = [
    '+60', '+65', '+62', '+66', '+63', '+84', '+44', '+1', '+61', '+86', '+81', '+82'
  ];

  void _loginWithPhone() {
    final phone = _phoneController.text.trim();
    final phoneRegex = RegExp(r'^\d{7,11}$');
    if (!phoneRegex.hasMatch(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid phone number (7 to 11 digits).')),
      );
      return;
    }
    // Navigate to OTP screen
    Navigator.pushNamed(context, '/otp');
  }

  void _loginWithGoogle() {
    print('Google login triggered');
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                    'Welcome Back',
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
                  Text(
                    'Log in to continue your coffee journey and enjoy exclusive rewards.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'DM Sans',
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Colors.white70,
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            
            // White Card
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.only(top: 32, left: 24, right: 24, bottom: 28),
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Phone Number Label
                    const Text(
                      'Phone Number',
                      style: TextStyle(
                        fontFamily: 'Playfair Display',
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                        color: Color(0xFFE56000),
                      ),
                    ),
                    const SizedBox(height: 8),
                    
                    // Phone Row
                    Row(
                      children: [
                        // Country Code Dropdown
                        Container(
                          width: 86,
                          height: 46,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            border: Border.all(color: const Color(0xFFE6DCD3), width: 1.5),
                            borderRadius: BorderRadius.circular(23),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x0A000000),
                                offset: Offset(0, 2),
                                blurRadius: 8,
                              )
                            ],
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: selectedCountryCode,
                              isExpanded: true,
                              icon: const SizedBox.shrink(), // Hide default icon
                              alignment: Alignment.center,
                              items: countryCodes.map((String value) {
                                return DropdownMenuItem<String>(
                                  value: value,
                                  child: Center(
                                    child: Text(
                                      value,
                                      style: const TextStyle(
                                        fontFamily: 'DM Sans',
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                        color: Color(0xFF1C3B24),
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                              onChanged: (String? newValue) {
                                setState(() {
                                  if (newValue != null) {
                                    selectedCountryCode = newValue;
                                  }
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        
                        // Phone Number Input
                        Expanded(
                          child: Container(
                            height: 46,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(23),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x0A000000),
                                  offset: Offset(0, 2),
                                  blurRadius: 8,
                                )
                              ],
                            ),
                            child: TextField(
                              controller: _phoneController,
                              keyboardType: TextInputType.phone,
                              style: const TextStyle(
                                fontFamily: 'DM Sans',
                                fontSize: 13.5,
                                color: Color(0xFF333333),
                              ),
                              decoration: InputDecoration(
                                hintText: '1234567890',
                                hintStyle: const TextStyle(
                                  color: Color(0xFFC4BDB5),
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 18),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(23),
                                  borderSide: const BorderSide(color: Color(0xFFE6DCD3), width: 1.5),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(23),
                                  borderSide: const BorderSide(color: Color(0xFFE6DCD3), width: 1.5),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(23),
                                  borderSide: const BorderSide(color: Color(0xFFE56000), width: 1.5),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // OR divider
                    Row(
                      children: [
                        const Expanded(child: Divider(color: Color(0xFFE6DCD3), thickness: 1)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: const Text(
                            'or',
                            style: TextStyle(
                              fontFamily: 'DM Sans',
                              fontSize: 13,
                              color: Color(0xFFB0A89E),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        const Expanded(child: Divider(color: Color(0xFFE6DCD3), thickness: 1)),
                      ],
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Google Button
                    InkWell(
                      onTap: _loginWithGoogle,
                      borderRadius: BorderRadius.circular(24),
                      child: Container(
                        width: double.infinity,
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: const Color(0xFFE6DCD3), width: 1.5),
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x0A000000),
                              offset: Offset(0, 2),
                              blurRadius: 8,
                            )
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            // Placeholder for Google SVG icon
                            Container(
                              width: 20,
                              height: 20,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.grey, // Replace with SVG/Image later
                              ),
                              child: const Icon(Icons.g_mobiledata, size: 20, color: Colors.white),
                            ),
                            const SizedBox(width: 10),
                            const Text(
                              'Continue with Google',
                              style: TextStyle(
                                fontFamily: 'DM Sans',
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF333333),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    
                    const Spacer(),
                    
                    // Bottom Section
                    Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'New member? ',
                              style: TextStyle(
                                fontFamily: 'DM Sans',
                                fontSize: 13,
                                color: Color(0xFF4A3A2F),
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                // Navigate to join screen
                                Navigator.pushNamed(context, '/step1');
                              },
                              child: const Text(
                                'Join now',
                                style: TextStyle(
                                  fontFamily: 'DM Sans',
                                  fontSize: 13,
                                  color: Color(0xFFE56000),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        
                        // LOGIN Button
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton(
                            onPressed: _loginWithPhone,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE56000),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(25),
                              ),
                              elevation: 0, // Using manual shadow below to match design
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
                                'LOGIN',
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
