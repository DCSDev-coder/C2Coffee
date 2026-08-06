import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'loading_order_page.dart';
import '../utils/app_colors.dart';

class ReferralPage extends StatelessWidget {
  const ReferralPage({super.key});

  @override
  Widget build(BuildContext context) {
    const Color brandColor = Color(0xFF2E5E58);
    const Color cardBgColor = Color(0xFFEDF4F3);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const InteractiveFillingLoader(),
          ),
        );
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: Stack(
          children: [
            Column(
              children: [
                // Header
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.only(
                      top: 50, bottom: 12, left: 20, right: 20),
                  decoration: const BoxDecoration(
                    color: Color(0xFF2E5E58),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(20),
                      bottomRight: Radius.circular(20),
                    ),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    const InteractiveFillingLoader(),
                              ),
                            );
                          },
                          child: const Icon(Icons.arrow_back_ios,
                              color: Colors.white, size: 20),
                        ),
                      ),
                      const Text(
                        'REFER A FRIEND',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),

                // Scrollable Body
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 24),
                    child: Column(
                      children: [
                        // Invite A Friend Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: cardBgColor,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: const Color(0xFFCFDEDB), width: 1),
                          ),
                          child: Column(
                            children: [
                              // Illustration Placeholder
                              const Icon(
                                Icons.group_add_outlined,
                                size: 80,
                                color: brandColor,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'INVITE A FRIEND',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 30,
                                  fontWeight: FontWeight.w900,
                                  color: brandColor,
                                  letterSpacing: 1.5,
                                ),
                              ),
                              const SizedBox(height: 8),
                              RichText(
                                textAlign: TextAlign.center,
                                text: const TextSpan(
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 15,
                                    color: brandColor,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  children: [
                                    TextSpan(text: 'Sharing with a friend\ngives you '),
                                    TextSpan(
                                      text: '10 points 🔥',
                                      style: TextStyle(
                                        color: AppColors.softGold,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    TextSpan(text: ' (true story).'),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 24, vertical: 8),
                                decoration: BoxDecoration(
                                  color: brandColor,
                                  borderRadius: BorderRadius.circular(30),
                                ),
                                child: const Text(
                                  'SHARE & EARN TOGETHER!',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Unique Code Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                                color: const Color(0xFFCFDEDB), width: 1),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              const Text(
                                'YOUR UNIQUE CODE',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 18,
                                  fontWeight: FontWeight.w900,
                                  color: brandColor,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFEDF4F3),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                      color: const Color(0xFFCFDEDB)),
                                ),
                                alignment: Alignment.center,
                                child: const Text(
                                  'DSC123',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: brandColor,
                                    letterSpacing: 2,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap: () {
                                  Clipboard.setData(
                                      const ClipboardData(text: 'DSC123'));
                                },
                                child: Container(
                                  width: double.infinity,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  decoration: BoxDecoration(
                                    color: brandColor,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(Icons.ios_share,
                                          color: Colors.white, size: 20),
                                      SizedBox(width: 8),
                                      Text(
                                        'Share',
                                        style: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // How It Works Divider
                        Row(
                          children: const [
                            Expanded(
                                child:
                                    Divider(color: Color(0xFFCFDEDB), thickness: 1)),
                            Padding(
                              padding:
                                  EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'How It Works',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                            ),
                            Expanded(
                                child:
                                    Divider(color: Color(0xFFCFDEDB), thickness: 1)),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Steps Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                                color: const Color(0xFFCFDEDB), width: 1),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              _buildStep(1, "Let's Share",
                                  "share whatever whatever", brandColor),
                              const SizedBox(height: 20),
                              _buildStep(2, "Let's Share",
                                  "share whatever whatever", brandColor),
                              const SizedBox(height: 20),
                              _buildStep(3, "Let's Share",
                                  "share whatever whatever", brandColor),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),

                        // My Achievements Divider
                        Row(
                          children: const [
                            Expanded(
                                child:
                                    Divider(color: Color(0xFFCFDEDB), thickness: 1)),
                            Padding(
                              padding:
                                  EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'My Achievements',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: brandColor,
                                ),
                              ),
                            ),
                            Expanded(
                                child:
                                    Divider(color: Color(0xFFCFDEDB), thickness: 1)),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Achievements Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          decoration: BoxDecoration(
                            color: brandColor,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 8,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  children: const [
                                    Text(
                                      'Friends Invited',
                                      style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    SizedBox(height: 8),
                                    Text(
                                      '0',
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 48,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                        height: 1.0,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                width: 1.5,
                                height: 70,
                                color: Colors.white.withValues(alpha: 0.3),
                              ),
                              Expanded(
                                child: Column(
                                  children: [
                                    const Text(
                                      'Total Earned',
                                      style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.white,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.end,
                                      children: const [
                                        Padding(
                                          padding: EdgeInsets.only(
                                              bottom: 8.0, right: 4.0),
                                          child: Text(
                                            'RM',
                                            style: TextStyle(
                                              fontFamily: 'Afacad',
                                              fontSize: 18,
                                              color: Colors.white,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          '0',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 48,
                                            fontWeight: FontWeight.bold,
                                            color: Colors.white,
                                            height: 1.0,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 40),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep(
      int number, String title, String description, Color orangeColor) {
    return Row(
      children: [
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: const Color(0xFF2E5E58),
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 4,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: Text(
            number.toString(),
            style: const TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 28,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14,
                  color: Colors.black87,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
