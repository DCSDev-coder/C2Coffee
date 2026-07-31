import 'package:flutter/material.dart';

class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

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
                  'PRIVACY POLICY',
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
                '1. Introduction\n'
                'Welcome to C2 Coffee. We value your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our application.\n\n'
                '2. Data We Collect\n'
                'We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:\n'
                '• Identity Data includes first name, last name, username or similar identifier.\n'
                '• Contact Data includes email address and telephone numbers.\n'
                '• Transaction Data includes details about payments to and from you and other details of products and services you have purchased from us.\n\n'
                '3. How We Use Your Data\n'
                'We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:\n'
                '• Where we need to perform the contract we are about to enter into or have entered into with you.\n'
                '• Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.\n\n'
                '4. Data Security\n'
                'We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.\n\n'
                '5. Your Legal Rights\n'
                'Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, or restriction of processing.',
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
