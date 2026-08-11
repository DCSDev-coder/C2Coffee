import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:intl_phone_field/intl_phone_field.dart';
import 'package:intl_phone_field/countries.dart' as intl_countries;
import 'package:flutter/foundation.dart' show kIsWeb;

import 'signup2.dart';
import 'login.dart';
import 'auth_transition.dart';
import '../services/user_service.dart';

class Signup1 extends StatefulWidget {
  const Signup1({super.key});

  @override
  State<Signup1> createState() => _Signup1State();
}

// Aliases for compatibility
typedef Signup1Backup = Signup1;

class _Signup1State extends State<Signup1> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _birthdayController = TextEditingController();

  File? _pickedImage;
  String? _presetAvatarPath;
  DateTime? _selectedDate;
  bool _isPhoneValid = false;
  int _selectedAvatarIndex = -1;
  String _fullPhoneNumber = '';

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  @override
  void initState() {
    super.initState();
    _usernameController.addListener(_onFieldChanged);
    _emailController.addListener(_onFieldChanged);
    _phoneController.addListener(_onFieldChanged);
    _birthdayController.addListener(_onFieldChanged);
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
    _usernameController.removeListener(_onFieldChanged);
    _emailController.removeListener(_onFieldChanged);
    _phoneController.removeListener(_onFieldChanged);
    _birthdayController.removeListener(_onFieldChanged);
    _usernameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _birthdayController.dispose();
    super.dispose();
  }

  bool get _isFormValid {
    final username = _usernameController.text.trim();
    final email = _emailController.text.trim();
    final birthday = _birthdayController.text.trim();

    final isUsernameValid = username.isNotEmpty;
    final isEmailValid = email.isNotEmpty &&
        RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
    final isPhoneValid = _fullPhoneNumber.isNotEmpty && _isPhoneValid;
    final isBirthdayValid = birthday.isNotEmpty && _selectedDate != null;

    return isUsernameValid && isEmailValid && isPhoneValid && isBirthdayValid;
  }

  String get _birthdayApiValue {
    if (_selectedDate == null) return '';
    return DateFormat('yyyy-MM-dd').format(_selectedDate!);
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

  void _openSimpleDatePicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        DateTime initialDate = _selectedDate ?? DateTime.now();
        int selectedYear = initialDate.year;
        int selectedMonth = initialDate.month;
        int selectedDay = initialDate.day;

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.50,
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Select Birthday',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1F3A34))),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.grey),
                        onPressed: () => Navigator.pop(context),
                        constraints:
                            const BoxConstraints(minWidth: 30, minHeight: 30),
                        padding: EdgeInsets.zero,
                      ),
                    ],
                  ),
                  const Divider(height: 12),
                  const SizedBox(height: 4),
                  Expanded(
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            children: [
                              const Text('Year',
                                  style: TextStyle(
                                      color: Color(0xFF1F3A34),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13)),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 34,
                                  perspective: 0.005,
                                  diameterRatio: 1.2,
                                  offAxisFraction: -0.5,
                                  onSelectedItemChanged: (index) =>
                                      setSheetState(() => selectedYear =
                                          DateTime.now().year - index),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: 100,
                                    builder: (context, index) {
                                      int year = DateTime.now().year - index;
                                      bool isSelected = year == selectedYear;
                                      return Center(
                                        child: Text(
                                          year.toString(),
                                          style: TextStyle(
                                            fontSize: isSelected ? 18 : 14,
                                            fontWeight: isSelected
                                                ? FontWeight.bold
                                                : FontWeight.normal,
                                            color: isSelected
                                                ? const Color(0xFF1F3A34)
                                                : Colors.grey.shade400,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              const Text('Month',
                                  style: TextStyle(
                                      color: Color(0xFF1F3A34),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13)),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 34,
                                  perspective: 0.005,
                                  diameterRatio: 1.2,
                                  offAxisFraction: 0,
                                  onSelectedItemChanged: (index) =>
                                      setSheetState(
                                          () => selectedMonth = index + 1),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: 12,
                                    builder: (context, index) {
                                      int month = index + 1;
                                      bool isSelected = month == selectedMonth;
                                      return Center(
                                        child: Text(
                                          DateFormat('MMM')
                                              .format(DateTime(2000, month, 1)),
                                          style: TextStyle(
                                            fontSize: isSelected ? 18 : 14,
                                            fontWeight: isSelected
                                                ? FontWeight.bold
                                                : FontWeight.normal,
                                            color: isSelected
                                                ? const Color(0xFF1F3A34)
                                                : Colors.grey.shade400,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              const Text('Day',
                                  style: TextStyle(
                                      color: Color(0xFF1F3A34),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13)),
                              Expanded(
                                child: ListWheelScrollView.useDelegate(
                                  itemExtent: 34,
                                  perspective: 0.005,
                                  diameterRatio: 1.2,
                                  offAxisFraction: 0.5,
                                  onSelectedItemChanged: (index) =>
                                      setSheetState(
                                          () => selectedDay = index + 1),
                                  childDelegate: ListWheelChildBuilderDelegate(
                                    childCount: 31,
                                    builder: (context, index) {
                                      int day = index + 1;
                                      bool isSelected = day == selectedDay;
                                      return Center(
                                        child: Text(
                                          day.toString(),
                                          style: TextStyle(
                                            fontSize: isSelected ? 18 : 14,
                                            fontWeight: isSelected
                                                ? FontWeight.bold
                                                : FontWeight.normal,
                                            color: isSelected
                                                ? const Color(0xFF1F3A34)
                                                : Colors.grey.shade400,
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: () {
                        final selectedDateTime =
                            DateTime(selectedYear, selectedMonth, selectedDay);
                        setState(() {
                          _selectedDate = selectedDateTime;
                          _birthdayController.text = DateFormat('dd MMM yyyy')
                              .format(selectedDateTime);
                        });
                        Navigator.pop(context);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1F3A34),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(25)),
                      ),
                      child: const Text('Confirm Date',
                          style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.white)),
                    ),
                  ),
                ],
              ),
            );
          },
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
    final mediaQuery = MediaQuery.of(context);
    final keyboardInset = mediaQuery.viewInsets.bottom;
    final cardBottomInset = keyboardInset > 0 ? keyboardInset : 0.0;
    final keyboardBackdropHeight =
        keyboardInset > 0 ? keyboardInset + mediaQuery.padding.bottom + 24 : 0.0;

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
                // Top Section (Fixed, non-scrolling top)
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
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
                      const Text(
                        'Step 1 of 2',
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 20,
                            fontStyle: FontStyle.italic,
                            color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Create Your Account',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: Colors.white),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Join C2 and start earning rewards with every sip.',
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
                            _buildTextField(
                              label: 'Username',
                              hintText: 'Username',
                              controller: _usernameController,
                            ),
                            const SizedBox(height: 10),
                            _buildTextField(
                              label: 'Email',
                              hintText: 'Email@gmail.com',
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                            ),
                            const SizedBox(height: 10),
                            _buildPhoneField(),
                            const SizedBox(height: 10),
                            _buildBirthdayField(),

                            const SizedBox(height: 12),

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
                                      TextSpan(text: 'Already a member? '),
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
                            const SizedBox(height: 12),

                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: _isFormValid
                                    ? () async {
                                        // Save profile details to UserService
                                        await UserService.saveUserProfile({
                                          'username':
                                              _usernameController.text.trim(),
                                          'email': _emailController.text.trim(),
                                          'phone': _fullPhoneNumber,
                                          'birthday': _birthdayApiValue,
                                        });

                                        if (!context.mounted) return;
                                        Navigator.push(
                                          context,
                                          buildAuthRoute(
                                            Signup2(
                                              initialPickedImage: _pickedImage,
                                              initialPresetPath:
                                                  _presetAvatarPath,
                                              initialAvatarIndex:
                                                  _selectedAvatarIndex,
                                            ),
                                          ),
                                        );
                                      }
                                    : null,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1F3A34),
                                  disabledBackgroundColor: Colors.grey.shade400,
                                  foregroundColor: Colors.white,
                                  disabledForegroundColor: Colors.white70,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(30)),
                                ),
                                child: const Text(
                                  'NEXT STEP',
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
                                    MediaQuery.of(context).padding.bottom),
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
    VoidCallback? onTap,
    Widget? suffixIcon,
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
            onTap: onTap,
            onTapOutside: (_) => FocusScope.of(context).unfocus(),
            style: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              hintText: hintText,
              hintStyle: const TextStyle(
                  fontFamily: 'Afacad', fontSize: 15, color: Colors.grey),
              suffixIcon: suffixIcon,
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

  Widget _buildBirthdayField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Birthday',
          style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFF2E5E58)),
        ),
        const SizedBox(height: 4),
        GestureDetector(
          onTap: _openSimpleDatePicker,
          child: Container(
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
            child: InputDecorator(
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                hintText: _selectedDate == null ? 'dd/mm/yy' : '',
                hintStyle: const TextStyle(
                    fontFamily: 'Afacad', fontSize: 15, color: Colors.grey),
                suffixIcon: const Icon(Icons.calendar_today_rounded,
                    color: Color(0xFF2E5E58), size: 20),
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
              child: Text(
                _selectedDate == null
                    ? ''
                    : DateFormat('dd/MM/yy').format(_selectedDate!),
                style: const TextStyle(
                    fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField() {
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
            initialCountryCode: 'MY',
            countries: [
              ...intl_countries.countries
                  .where((c) => c.code == 'MY')
                  .map((c) => intl_countries.Country(
                        name: ' Malaysia',
                        nameTranslations: {},
                        flag: c.flag,
                        code: c.code,
                        dialCode: c.dialCode,
                        minLength: c.minLength,
                        maxLength: c.maxLength,
                        regionCode: c.regionCode,
                      )),
              ...intl_countries.countries
                  .where((c) => c.code == 'SG')
                  .map((c) => intl_countries.Country(
                        name: ' Singapore',
                        nameTranslations: {},
                        flag: c.flag,
                        code: c.code,
                        dialCode: c.dialCode,
                        minLength: c.minLength,
                        maxLength: c.maxLength,
                        regionCode: c.regionCode,
                      )),
              ...intl_countries.countries
                  .where((c) => c.code != 'MY' && c.code != 'SG'),
            ],
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
                borderSide:
                    const BorderSide(color: Color(0xFF2E5E58), width: 1.5),
              ),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            style: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            dropdownTextStyle: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
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
            onCountryChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }
}
