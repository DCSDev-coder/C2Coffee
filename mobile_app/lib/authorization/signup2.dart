import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import 'otp_verification.dart';
import 'login.dart';
import '../services/user_service.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

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

class _Signup2State extends State<Signup2> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _houseController = TextEditingController();
  final TextEditingController _streetController = TextEditingController();
  final TextEditingController _postcodeController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _referralCodeController = TextEditingController();

  String? _selectedGender;

  // Avatar State
  File? _pickedImage;
  String? _presetAvatarPath;
  int _selectedAvatarIndex = 0;

  final List<Map<String, dynamic>> _avatarOptions = [
    {'path': 'assets/images/dato.png', 'name': 'Dato'},
    {'path': 'assets/images/datin.png', 'name': 'Datin'},
  ];

  final Map<String, String> _malaysiaPostcodes = {
    '50000': 'Kuala Lumpur',
    '50400': 'Kuala Lumpur',
    '50600': 'Kuala Lumpur',
    '50700': 'Kuala Lumpur',
    '40000': 'Shah Alam',
    '40100': 'Shah Alam',
    '40200': 'Shah Alam',
    '46000': 'Petaling Jaya',
    '46100': 'Petaling Jaya',
    '46200': 'Petaling Jaya',
    '46300': 'Petaling Jaya',
    '47000': 'Sungai Buloh',
    '47100': 'Puchong',
    '47150': 'Puchong',
    '47200': 'Subang Jaya',
    '47300': 'Petaling Jaya',
    '47500': 'Subang Jaya',
    '47600': 'Subang Jaya',
    '47800': 'Petaling Jaya',
    '48000': 'Rawang',
    '48050': 'Rawang',
    '48020': 'Rawang',
    '48010': 'Kuala Selangor',
    '48100': 'Kuala Selangor',
    '48200': 'Kuala Selangor',
    '48300': 'Kuala Selangor',
    '48400': 'Kuala Selangor',
    '48500': 'Kuala Selangor',
    '48600': 'Kuala Selangor',
    '48700': 'Kuala Selangor',
    '48800': 'Kuala Selangor',
    '43000': 'Kajang',
    '43200': 'Cheras',
    '43300': 'Seri Kembangan',
    '43400': 'Serdang',
    '43500': 'Semenyih',
    '43600': 'Bangi / UKM',
    '43700': 'Beranang',
    '43800': 'Dengkil',
    '43900': 'Sepang',
    '44000': 'Kuala Kubu Bharu',
    '44100': 'Kerling',
    '44200': 'Rasa',
    '44300': 'Batang Kali',
    '45000': 'Kuala Selangor',
    '10000': 'George Town',
    '10100': 'George Town',
    '10200': 'George Town',
    '10300': 'George Town',
    '10400': 'George Town',
    '10500': 'George Town',
    '11600': 'George Town',
    '11700': 'George Town',
    '11800': 'George Town',
    '11900': 'Bayan Lepas',
    '12000': 'Butterworth',
    '12100': 'Butterworth',
    '12200': 'Butterworth',
    '12300': 'Butterworth',
    '12400': 'Butterworth',
    '12500': 'Butterworth',
    '12600': 'Butterworth',
    '12700': 'Butterworth',
    '80000': 'Johor Bahru',
    '80100': 'Johor Bahru',
    '80200': 'Johor Bahru',
    '80300': 'Johor Bahru',
    '80400': 'Johor Bahru',
    '80500': 'Johor Bahru',
    '80600': 'Johor Bahru',
    '80700': 'Johor Bahru',
    '80800': 'Johor Bahru',
    '80900': 'Johor Bahru',
    '81100': 'Johor Bahru',
    '81200': 'Johor Bahru',
    '81300': 'Skudai',
    '81400': 'Senai',
    '81500': 'Pekan Nenas',
    '81600': 'Pasir Gudang',
    '81700': 'Pasir Gudang',
    '81800': 'Ulu Tiram',
    '81900': 'Kota Tinggi',
    '82000': 'Pontian',
    '83000': 'Batu Pahat',
    '84000': 'Muar',
    '85000': 'Segamat',
    '86000': 'Kluang',
    '87000': 'Labis',
    '70000': 'Seremban',
    '70100': 'Seremban',
    '70200': 'Seremban',
    '70300': 'Seremban',
    '70400': 'Seremban',
    '70500': 'Seremban',
    '71000': 'Port Dickson',
    '71200': 'Port Dickson',
    '72000': 'Kuala Pilah',
    '72100': 'Bahau',
    '73000': 'Tampin',
    '30000': 'Ipoh',
    '30100': 'Ipoh',
    '30200': 'Ipoh',
    '30300': 'Ipoh',
    '30400': 'Ipoh',
    '30500': 'Ipoh',
    '30600': 'Ipoh',
    '30700': 'Ipoh',
    '30800': 'Ipoh',
    '30900': 'Ipoh',
    '31000': 'Batu Gajah',
    '31100': 'Sungai Siput',
    '31200': 'Chemor',
    '31300': 'Kamunting',
    '31400': 'Ipoh',
    '31500': 'Lahat',
    '31600': 'Gopeng',
    '31700': 'Tronoh',
    '31800': 'Tanjung Tualang',
    '31900': 'Kampar',
    '32000': 'Sitiawan',
    '32200': 'Lumut',
    '32600': 'Bota',
    '32700': 'Bidor',
    '32800': 'Tapah',
    '33000': 'Kuala Kangsar',
    '34000': 'Taiping',
    '35000': 'Tanjung Malim',
    '25000': 'Kuantan',
    '25100': 'Kuantan',
    '25200': 'Kuantan',
    '25300': 'Kuantan',
    '25400': 'Kuantan',
    '25500': 'Kuantan',
    '26000': 'Kuantan',
    '26100': 'Kuantan',
    '26200': 'Kuantan',
    '26300': 'Kuantan',
    '26400': 'Kuantan',
    '26500': 'Kuantan',
    '26600': 'Pekan',
    '26700': 'Muadzam Shah',
    '26800': 'Bentong',
    '27000': 'Jerantut',
    '27100': 'Kuala Lipis',
    '27200': 'Kuala Lipis',
    '27300': 'Bentong',
    '27400': 'Bentong',
    '27500': 'Bentong',
    '27600': 'Raub',
    '27700': 'Raub',
    '27800': 'Raub',
    '27900': 'Raub',
    '28000': 'Temerloh',
    '28100': 'Temerloh',
    '28200': 'Temerloh',
    '28300': 'Temerloh',
    '28400': 'Temerloh',
    '28500': 'Temerloh',
    '28600': 'Temerloh',
    '28700': 'Temerloh',
    '28800': 'Temerloh',
    '28900': 'Bentong',
    '39000': 'Cameron Highlands',
    '05000': 'Alor Setar',
    '05100': 'Alor Setar',
    '05200': 'Alor Setar',
    '05300': 'Alor Setar',
    '05400': 'Alor Setar',
    '05500': 'Alor Setar',
    '05600': 'Alor Setar',
    '05700': 'Alor Setar',
    '06000': 'Jitra',
    '06100': 'Kodiang',
    '06200': 'Kepala Batas',
    '06300': 'Gurun',
    '06500': 'Sungai Petani',
    '06600': 'Sungai Petani',
    '06700': 'Pendang',
    '06800': 'Alor Setar',
    '06900': 'Kulim',
    '07000': 'Langkawi',
    '08000': 'Sungai Petani',
    '09000': 'Kulim',
    '15000': 'Kota Bharu',
    '15100': 'Kota Bharu',
    '15200': 'Kota Bharu',
    '15300': 'Kota Bharu',
    '16000': 'Tumpat',
    '16100': 'Pasir Mas',
    '16200': 'Pasir Puteh',
    '16300': 'Bachok',
    '16400': 'Machang',
    '16500': 'Gua Musang',
    '20000': 'Kuala Terengganu',
    '20100': 'Kuala Terengganu',
    '20200': 'Kuala Terengganu',
    '20300': 'Kuala Terengganu',
    '20400': 'Kuala Terengganu',
    '20500': 'Kuala Terengganu',
    '21000': 'Marang',
    '21100': 'Dungun',
    '21200': 'Kemaman',
    '21300': 'Kuala Berang',
    '22000': 'Besut',
    '23000': 'Kerteh',
    '88000': 'Kota Kinabalu',
    '88100': 'Kota Kinabalu',
    '88200': 'Kota Kinabalu',
    '88300': 'Kota Kinabalu',
    '88400': 'Kota Kinabalu',
    '88500': 'Kota Kinabalu',
    '88600': 'Kota Kinabalu',
    '88700': 'Kota Kinabalu',
    '88800': 'Kota Kinabalu',
    '88900': 'Kota Kinabalu',
    '89000': 'Keningau',
    '89100': 'Kota Marudu',
    '89200': 'Tuaran',
    '89300': 'Penampang',
    '89400': 'Papar',
    '89500': 'Tenom',
    '89600': 'Ranau',
    '89700': 'Beaufort',
    '89800': 'Sipitang',
    '90000': 'Sandakan',
    '90100': 'Sandakan',
    '90200': 'Sandakan',
    '90300': 'Sandakan',
    '90400': 'Sandakan',
    '90500': 'Sandakan',
    '90600': 'Sandakan',
    '90700': 'Sandakan',
    '90800': 'Sandakan',
    '90900': 'Sandakan',
    '91000': 'Lahad Datu',
    '91100': 'Kunak',
    '91200': 'Semporna',
    '91300': 'Tawau',
    '91400': 'Tawau',
    '91500': 'Tawau',
    '91600': 'Tawau',
    '91700': 'Tawau',
    '91800': 'Tawau',
    '91900': 'Tawau',
    '93000': 'Kuching',
    '93100': 'Kuching',
    '93200': 'Kuching',
    '93300': 'Kuching',
    '93400': 'Kuching',
    '93500': 'Kuching',
    '93600': 'Kuching',
    '93700': 'Kuching',
    '93800': 'Kuching',
    '93900': 'Kuching',
    '94000': 'Bau',
    '94200': 'Serian',
    '94300': 'Kota Samarahan',
    '94500': 'Lundu',
    '95000': 'Sri Aman',
    '96000': 'Sibu',
    '96100': 'Sibu',
    '96200': 'Sibu',
    '96300': 'Sibu',
    '96400': 'Sibu',
    '96500': 'Sibu',
    '96600': 'Sibu',
    '96700': 'Sibu',
    '96800': 'Sibu',
    '96900': 'Sibu',
    '97000': 'Bintulu',
    '97100': 'Bintulu',
    '97200': 'Bintulu',
    '97300': 'Bintulu',
    '97400': 'Bintulu',
    '97500': 'Bintulu',
    '97600': 'Bintulu',
    '97700': 'Bintulu',
    '97800': 'Bintulu',
    '97900': 'Bintulu',
    '98000': 'Miri',
    '98100': 'Miri',
    '98200': 'Miri',
    '98300': 'Miri',
    '98400': 'Miri',
    '98500': 'Miri',
    '98600': 'Miri',
    '98700': 'Miri',
  };

  @override
  void initState() {
    super.initState();
    _pickedImage = widget.initialPickedImage;
    _presetAvatarPath = widget.initialPresetPath;
    _selectedAvatarIndex = widget.initialAvatarIndex;

    _postcodeController.addListener(_onPostcodeChanged);
  }

  void _onPostcodeChanged() {
    final String code = _postcodeController.text.trim();
    if (code.length == 5) {
      final String? foundCity = _malaysiaPostcodes[code];
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _cityController.text = foundCity ?? '';
          });
        }
      });
    } else if (code.length < 5) {
      if (_cityController.text.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _cityController.text = '';
            });
          }
        });
      }
    }
  }

  @override
  void dispose() {
    _postcodeController.removeListener(_onPostcodeChanged);
    _houseController.dispose();
    _streetController.dispose();
    _postcodeController.dispose();
    _cityController.dispose();
    _referralCodeController.dispose();
    super.dispose();
  }

  bool get _isFormValid {
    return _postcodeController.text.trim().length == 5 &&
        _cityController.text.trim().isNotEmpty &&
        _selectedGender != null;
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
                    const Text('Step 2 of 2',
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 20,
                            fontStyle: FontStyle.italic,
                            color: orangeColor)),
                    const SizedBox(height: 4),
                    const Text('Refine Your Profile',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: orangeColor)),
                    const SizedBox(height: 4),
                    const Text(
                        'Complete your registration to unlock the full experience.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 13,
                            color: Colors.black87)),
                    const SizedBox(height: 16),

                    // Optional House
                    _buildTextField(
                        label: 'House / Unit No. (Optional)',
                        hintText: 'e.g. Number 1',
                        controller: _houseController),
                    const SizedBox(height: 10),

                    // Optional Street
                    _buildTextField(
                        label: 'Street Name (Optional)',
                        hintText: 'Jalan Coffee Lane',
                        controller: _streetController),
                    const SizedBox(height: 10),

                    Row(
                      children: [
                        Expanded(
                          flex: 4,
                          child: _buildTextField(
                              label: 'Postcode',
                              hintText: '43500',
                              controller: _postcodeController,
                              keyboardType: TextInputType.number),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          flex: 6,
                          child: _buildTextField(
                              label: 'City',
                              hintText: 'Semenyih',
                              controller: _cityController,
                              readOnly: true),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Gender',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: orangeColor)),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Expanded(
                                child:
                                    _buildGenderButton('Female', Icons.female)),
                            const SizedBox(width: 16),
                            Expanded(
                                child: _buildGenderButton('Male', Icons.male)),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Referral Code
                    _buildTextField(
                        label: "Add your friend's referral code (Optional)",
                        hintText: "e.g. DSC123",
                        controller: _referralCodeController),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text('Already a member? ',
                            style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 14,
                                color: Colors.black87)),
                        GestureDetector(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (context) => const LoginPage()),
                            );
                          },
                          child: const Text('Login',
                              style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: orangeColor)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
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
                          side:
                              BorderSide(color: Colors.grey.shade300, width: 1),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(30)),
                        ),
                        child: const Text('PREVIOUS STEP',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0)),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton(
                        // Pass avatar state to OTP Page here
                        onPressed: _isFormValid
                            ? () async {
                                String fullAddress = '${_houseController.text.trim()}, ${_streetController.text.trim()}, ${_postcodeController.text.trim()} ${_cityController.text.trim()}';
                                await UserService.saveUserProfile({
                                  'gender': _selectedGender ?? '',
                                  'address': fullAddress,
                                });

                                if (!context.mounted) return;
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
                        child: const Text('SIGN UP',
                            style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.0)),
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
        Text(label,
            style: const TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFFE76D00))),
        const SizedBox(height: 4),
        Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(16),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x08000000), blurRadius: 6, offset: Offset(0, 2))
            ],
          ),
          child: TextFormField(
            controller: controller,
            keyboardType: keyboardType,
            readOnly: readOnly,
            style: const TextStyle(
                fontFamily: 'Afacad', fontSize: 15, color: Colors.black87),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: const TextStyle(
                  fontFamily: 'Afacad', fontSize: 15, color: Colors.grey),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none),
              focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide:
                      const BorderSide(color: Color(0xFFE76D00), width: 1.5)),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildGenderButton(String gender, IconData icon) {
    final bool isSelected = _selectedGender == gender;
    const Color orangeColor = Color(0xFFE76D00);

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
}
