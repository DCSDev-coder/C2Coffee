import 'package:flutter/material.dart';

class TermsOfUsePage extends StatelessWidget {
  const TermsOfUsePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          // Header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.only(top: 60, bottom: 20, left: 20, right: 20),
            decoration: const BoxDecoration(
              color: Color(0xFFE66B00),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(30),
                bottomRight: Radius.circular(30),
              ),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 24),
                  ),
                ),
                const Text(
                  'TERMS OF USE',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          // Content
          const Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.all(24),
              child: Text(
                '1. Acceptance of Terms\n'
                'By downloading, accessing, or using the C2 Coffee mobile application, you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the application.\n\n'
                '2. Account Registration\n'
                'To use certain features of the app, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.\n\n'
                '3. Orders and Payments\n'
                'All orders placed through the app are subject to availability and acceptance. Prices are subject to change without notice. You agree to provide current, complete, and accurate purchase and account information for all purchases made via the app.\n\n'
                '4. Reward Points and Loyalty Program\n'
                'Reward points earned through the app have no cash value and cannot be exchanged for cash. C2 Coffee reserves the right to modify or terminate the rewards program at any time without prior notice.\n\n'
                '5. Intellectual Property\n'
                'All content included in the app, such as text, graphics, logos, images, and software, is the property of C2 Coffee and is protected by copyright and other laws.\n\n'
                '6. Modifications to Terms\n'
                'We reserve the right to modify these Terms of Use at any time. Your continued use of the app following any changes indicates your acceptance of the new terms.',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  color: Colors.black87,
                  height: 1.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
