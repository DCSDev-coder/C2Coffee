import 'package:flutter/material.dart';

class Step2Screen extends StatefulWidget {
  const Step2Screen({Key? key}) : super(key: key);

  @override
  State<Step2Screen> createState() => _Step2ScreenState();
}

class _Step2ScreenState extends State<Step2Screen> {
  final TextEditingController _unitController = TextEditingController();
  final TextEditingController _streetController = TextEditingController();
  final TextEditingController _postcodeController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  String? _selectedGender;

  @override
  void dispose() {
    _unitController.dispose();
    _streetController.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    super.dispose();
  }

  void _validateStep2() {
    // Basic validation
    if (_unitController.text.trim().isEmpty || 
        _streetController.text.trim().isEmpty || 
        _postcodeController.text.trim().isEmpty ||
        _cityController.text.trim().isEmpty ||
        _selectedGender == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }
    // Navigate to completion / home
    Navigator.pushNamedAndRemoveUntil(context, '/home', (route) => false);
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
                    'Step 2 of 2',
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
                    'Refine Your Profile',
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
                    'Complete your registration to unlock the full experience.',
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
                      // House / Unit No.
                      _buildLabel('House / Unit No.'),
                      _buildTextField(
                        controller: _unitController,
                        hintText: 'Number 1',
                        keyboardType: TextInputType.text,
                      ),
                      const SizedBox(height: 14),

                      // Street Name
                      _buildLabel('Street Name'),
                      _buildTextField(
                        controller: _streetController,
                        hintText: 'Jalan Coffee',
                        keyboardType: TextInputType.streetAddress,
                      ),
                      const SizedBox(height: 14),
                      
                      // Postcode + City Row
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildLabel('Postcode'),
                                _buildTextField(
                                  controller: _postcodeController,
                                  hintText: '43000',
                                  keyboardType: TextInputType.number,
                                  maxLength: 5,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                _buildLabel('City'),
                                _buildTextField(
                                  controller: _cityController,
                                  hintText: 'Semenyih',
                                  keyboardType: TextInputType.text,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Gender Selection
                      _buildLabel('Gender'),
                      Row(
                        children: [
                          Expanded(child: _buildGenderButton('female', 'Female')),
                          const SizedBox(width: 10),
                          Expanded(child: _buildGenderButton('male', 'Male')),
                        ],
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
                          
                          // PREVIOUS STEP Button
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: () {
                                Navigator.pop(context);
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF1C3B24),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(25),
                                  side: const BorderSide(color: Color(0xFF1C3B24), width: 1.5),
                                ),
                                elevation: 0,
                              ),
                              child: const Text(
                                'PREVIOUS STEP',
                                style: TextStyle(
                                  fontFamily: 'Playfair Display',
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                  letterSpacing: 1.5,
                                  color: Color(0xFF1C3B24),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),

                          // SIGN UP Button
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _validateStep2,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFE56000),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(25),
                                ),
                                elevation: 0, // Handle shadow in child
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
                                  'SIGN UP',
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
    int? maxLength,
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
        maxLength: maxLength,
        style: const TextStyle(
          fontFamily: 'DM Sans',
          fontSize: 13.5,
          color: Color(0xFF333333),
        ),
        decoration: InputDecoration(
          counterText: '', // Hide default max length counter
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

  Widget _buildGenderButton(String value, String label) {
    bool isSelected = _selectedGender == value;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedGender = value;
        });
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 46,
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFFFF5EE) : Colors.white,
          border: Border.all(
            color: isSelected ? const Color(0xFFE56000) : const Color(0xFFE6DCD3),
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(23),
          boxShadow: [
            if (isSelected)
              BoxShadow(
                color: const Color(0xFFE56000).withOpacity(0.12),
                blurRadius: 0,
                spreadRadius: 3, // Simulate the box-shadow 0 0 0 3px
              )
            else
              const BoxShadow(
                color: Color(0x0A000000),
                offset: Offset(0, 2),
                blurRadius: 8,
              ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              value == 'female' ? Icons.female : Icons.male,
              color: isSelected ? const Color(0xFFE56000) : const Color(0xFF1C3B24),
              size: 18,
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: TextStyle(
                fontFamily: 'Playfair Display',
                fontWeight: FontWeight.w700,
                fontSize: 15,
                color: isSelected ? const Color(0xFFE56000) : const Color(0xFF1C3B24),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
