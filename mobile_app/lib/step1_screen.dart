import 'package:flutter/material.dart';

class Step1Screen extends StatefulWidget {
  const Step1Screen({Key? key}) : super(key: key);

  @override
  State<Step1Screen> createState() => _Step1ScreenState();
}

class _Step1ScreenState extends State<Step1Screen> {
  String selectedCountryCode = '+60';
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  DateTime? _birthday;

  final List<String> countryCodes = [
    '+60', '+65', '+62', '+66', '+63', '+84', '+44', '+1', '+61', '+86', '+81', '+82'
  ];

  @override
  void dispose() {
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _validateStep1() {
    // Basic validation
    if (_usernameController.text.trim().isEmpty || 
        _emailController.text.trim().isEmpty || 
        _phoneController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }
    // Navigate to step 2
    Navigator.pushNamed(context, '/step2');
  }

  Future<void> _selectBirthday() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _birthday ?? DateTime.now().subtract(const Duration(days: 365 * 18)), // default 18 years ago
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFE56000), // header background color
              onPrimary: Colors.white, // header text color
              onSurface: Color(0xFF333333), // body text color
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _birthday) {
      setState(() {
        _birthday = picked;
      });
    }
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
                    'Step 1 of 2',
                    style: TextStyle(
                      fontFamily: 'Playfair Display', // or Libre Baskerville
                      fontStyle: FontStyle.italic,
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                      color: Colors.white70, // rgba(255,255,255,0.9)
                      letterSpacing: 0.2,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Create Your Account',
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
                  const SizedBox(height: 8),
                  Text(
                    'Join C2 and start earning rewards with every sip.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'DM Sans',
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Colors.white.withOpacity(0.8),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            
            // White Form Card
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.only(top: 28, left: 24, right: 24, bottom: 24),
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
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Username
                      _buildLabel('Username'),
                      _buildTextField(
                        controller: _usernameController,
                        hintText: 'Username',
                        keyboardType: TextInputType.name,
                      ),
                      const SizedBox(height: 14),

                      // Email
                      _buildLabel('Email'),
                      _buildTextField(
                        controller: _emailController,
                        hintText: 'Email@gmail.com',
                        keyboardType: TextInputType.emailAddress,
                      ),
                      const SizedBox(height: 14),
                      
                      // Phone Number
                      _buildLabel('Phone Number'),
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
                            child: _buildTextField(
                              controller: _phoneController,
                              hintText: '1234567890',
                              keyboardType: TextInputType.phone,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Birthday
                      _buildLabel('Birthday'),
                      GestureDetector(
                        onTap: _selectBirthday,
                        child: Container(
                          width: double.infinity,
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
                          padding: const EdgeInsets.symmetric(horizontal: 18),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            _birthday == null
                                ? 'MM/DD/YYYY'
                                : "${_birthday!.month.toString().padLeft(2, '0')}/${_birthday!.day.toString().padLeft(2, '0')}/${_birthday!.year}",
                            style: TextStyle(
                              fontFamily: 'DM Sans',
                              fontSize: 13.5,
                              color: _birthday == null ? const Color(0xFFC4BDB5) : const Color(0xFF333333),
                            ),
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 24),
                      
                      // Bottom Section
                      Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text(
                                'Already a member? ',
                                style: TextStyle(
                                  fontFamily: 'DM Sans',
                                  fontSize: 13,
                                  color: Color(0xFF4A3A2F),
                                ),
                              ),
                              GestureDetector(
                                onTap: () {
                                  // Navigate to login
                                  Navigator.pushNamed(context, '/login');
                                },
                                child: const Text(
                                  'Login',
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
                          
                          // NEXT STEP Button
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _validateStep1,
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
                                  'NEXT STEP',
                                  style: TextStyle(
                                    fontFamily: 'Playfair Display',
                                    fontWeight: FontWeight.w700,
                                    fontSize: 14,
                                    letterSpacing: 1.5,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20), // Bottom padding for scroll
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Text(
        text,
        style: const TextStyle(
          fontFamily: 'Playfair Display',
          fontWeight: FontWeight.w700,
          fontSize: 14.5,
          color: Color(0xFF1C3B24),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    required TextInputType keyboardType,
  }) {
    return Container(
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
        controller: controller,
        keyboardType: keyboardType,
        style: const TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 13.5,
          color: Color(0xFF333333),
        ),
        decoration: InputDecoration(
          hintText: hintText,
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
    );
  }
}
