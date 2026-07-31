import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'loading_order_page.dart';

class ReferralPage extends StatelessWidget {
  const ReferralPage({super.key});

  @override
  Widget build(BuildContext context) {
    const Color orangeColor = Color(0xFFE76D00);
    const Color cardBgColor = Color(0xFFFDF9F6);

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
        backgroundColor: const Color(0xFFF5F5F5), // Light grey background
        body: Stack(
          children: [
            Column(
              children: [
                // Header
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.only(
                      top: 60, bottom: 20, left: 20, right: 20),
                  decoration: const BoxDecoration(
                    color: orangeColor,
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
                              color: Colors.white, size: 24),
                        ),
                      ),
                      const Text(
                        'REFER A FRIEND',
                        style: TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
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
                            border: Border.all(color: orangeColor, width: 1.5),
                          ),
                          child: Column(
                            children: [
                              // Illustration Placeholder
                              const Icon(
                                Icons.group_add_outlined,
                                size: 80,
                                color: orangeColor,
                              ),
                              const SizedBox(height: 16),
                              const Text(
                                'INVITE A FRIEND',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 32,
                                  fontWeight: FontWeight.w900,
                                  color: orangeColor,
                                  letterSpacing: 1.5,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'Sharing with a friend boosts\ngives you 10 points 🔥 (true story).',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: orangeColor,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              const SizedBox(height: 16),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 24, vertical: 8),
                                decoration: BoxDecoration(
                                  color: orangeColor,
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
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: orangeColor, width: 1),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
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
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                width: double.infinity,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 12),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade400,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                alignment: Alignment.center,
                                child: const Text(
                                  'DSC123',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                    letterSpacing: 2,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              GestureDetector(
                                onTap: () {
                                  Clipboard.setData(
                                      const ClipboardData(text: 'DSC123'));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content:
                                          const Text('Referral code copied!'),
                                      duration: const Duration(seconds: 2),
                                      behavior: SnackBarBehavior.floating,
                                      margin: EdgeInsets.only(
                                        bottom:
                                            MediaQuery.of(context).size.height -
                                                220,
                                        left: 20,
                                        right: 20,
                                      ),
                                    ),
                                  );
                                },
                                child: Container(
                                  width: double.infinity,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  decoration: BoxDecoration(
                                    color: orangeColor,
                                    borderRadius: BorderRadius.circular(8),
                                    boxShadow: [
                                      BoxShadow(
                                        color:
                                            orangeColor.withValues(alpha: 0.4),
                                        blurRadius: 8,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
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
                          children: [
                            const Expanded(
                                child:
                                    Divider(color: orangeColor, thickness: 1)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'How It Works',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: orangeColor,
                                ),
                              ),
                            ),
                            const Expanded(
                                child:
                                    Divider(color: orangeColor, thickness: 1)),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Steps Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: orangeColor, width: 1),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.05),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            children: [
                              _buildStep(1, "Let's Share",
                                  "share whatever whatever", orangeColor),
                              const SizedBox(height: 20),
                              _buildStep(2, "Let's Share",
                                  "share whatever whatever", orangeColor),
                              const SizedBox(height: 20),
                              _buildStep(3, "Let's Share",
                                  "share whatever whatever", orangeColor),
                            ],
                          ),
                        ),
                        const SizedBox(height: 32),

                        // My Achievements Divider
                        Row(
                          children: [
                            const Expanded(
                                child:
                                    Divider(color: orangeColor, thickness: 1)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                'My Achievements',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: orangeColor,
                                ),
                              ),
                            ),
                            const Expanded(
                                child:
                                    Divider(color: orangeColor, thickness: 1)),
                          ],
                        ),
                        const SizedBox(height: 24),

                        // Achievements Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 24),
                          decoration: BoxDecoration(
                            color: const Color(
                                0xFFE76D00), // Slightly darker orange for contrast
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.1),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
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
                                color: Colors.white,
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
            color: const Color(0xFFE76D00),
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
