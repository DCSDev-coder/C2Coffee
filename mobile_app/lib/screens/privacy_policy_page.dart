import 'package:flutter/material.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class PrivacyPolicyPage extends StatelessWidget {
  const PrivacyPolicyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'PRIVACY POLICY',
      onBack: () => Navigator.pop(context),
      backgroundColor: const Color(0xFFF9F9FB),
      bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildLastUpdated('September 4, 2026'),
          const SizedBox(height: 16),
          _buildSection(
            number: '1',
            title: 'Introduction & PDPA Compliance',
            body:
                'C2 Coffee ("C2 Coffee + Candle", "we", "us", or "our") respects your privacy and is dedicated to protecting the personal data of our customers in accordance with the Malaysian Personal Data Protection Act 2010 ("PDPA"). This Privacy Policy explains how we collect, process, manage, store, and safeguard your personal information when you use our mobile application ("App") and visit our retail coffee stores.',
          ),
          _buildSection(
            number: '2',
            title: 'Personal Data We Collect',
            body:
                'We collect personal data necessary to provide seamless coffee ordering, closed-loop token balances, and member rewards:\n\n'
                '• Identity & Profile Data: Full name, username, preferred name, and date of birth (optional, used for annual birthday reward vouchers).\n\n'
                '• Contact & Authentication Data: Email address, Malaysian mobile telephone number, and email One-Time Password (OTP) verification records. A new email address is applied only after its verification code is confirmed.\n\n'
                '• Financial & Transaction Ledger: Transaction timestamps, payment intent references, store pickup orders, C2 Token top-up ledger entries, token debit history, applied voucher redemptions, and referral associations.\n\n'
                '• Payment Card Notice: We do NOT collect, process, or store credit/debit card numbers (PAN), CVV codes, or banking credentials in the App.\n\n'
                '• Device & App Telemetry: Device identifier, operating system version, push notification tokens, IP address, and app usage logs.',
          ),
          _buildSection(
            number: '3',
            title: 'Purposes of Data Processing',
            body:
                'Your personal data is collected and processed for the following operational purposes:\n\n'
                '• Preparing and fulfilling your store self-pickup orders according to beverage customizations.\n\n'
                '• Managing your closed-loop C2 Token prepaid balance and calculating tiered member pricing (Kawan, Dilamun, Ketagih, Legend).\n\n'
                '• Administering loyalty cups progression, welcome rewards, and promotional campaign vouchers.\n\n'
                '• Authenticating your login sessions via email OTP.\n\n'
                '• Sending real-time order readiness alerts and critical operational notifications.\n\n'
                '• Detecting, preventing, and investigating fraud, unauthorized access, or referral abuse.',
          ),
          _buildSection(
            number: '4',
            title: 'Disclosure to Third-Party Service Providers',
            body:
                'We do not sell, rent, or lease your personal information to third parties. We may disclose personal data to trusted technical partners strictly on a need-to-know basis:\n\n'
                '• Payment Gateway: an authorized provider for C2 Token top-up once online top-up is enabled.\n\n'
                '• Email Delivery Service: authorized SMTP or transactional email infrastructure used to send account verification codes and service messages.\n\n'
                '• Cloud Infrastructure & Hosting: Secure cloud hosting providers with end-to-end encryption and strict access controls.\n\n'
                '• Legal & Regulatory Authorities: When required by applicable Malaysian law, court order, or governmental authority.',
          ),
          _buildSection(
            number: '5',
            title: 'Data Retention & 7-Year Ledger Policy',
            body:
                '5.1 In compliance with financial audit, taxation, and statutory accounting standards, user-linked financial records, token-ledger transactions, refund logs, voucher issuance records, and order histories are retained for a minimum period of seven (7) years.\n\n'
                '5.2 Ephemeral data such as temporary OTP authorization tokens and short-term session logs are regularly purged following verification.',
          ),
          _buildSection(
            number: '6',
            title: 'Data Security & Storage Controls',
            body:
                'We implement robust industry-standard physical, electronic, and procedural safeguards to secure your personal data:\n\n'
                '• Encrypted Data Transmission: All data transferred between the App and our backend servers is encrypted using modern TLS/HTTPS protocols.\n\n'
                '• Role-Based Access Control (RBAC): Internal access to user data is strictly limited to authorized operations and support personnel.\n\n'
                '• Continuous Monitoring: Automated logging and anomaly detection systems protect against unauthorized login attempts or abnormal transaction spikes.',
          ),
          _buildSection(
            number: '7',
            title: 'Account Closure & Data Deletion Workflow',
            body:
                '7.1 You have the right to request the closure of your account at any time through the App settings or by contacting C2 Support.\n\n'
                '7.2 Upon verified account closure, your active access credentials will be revoked immediately and your profile will be removed from standard marketing communications.\n\n'
                '7.3 Required financial and ledger records will be retained in a secure, restricted archive for the duration of the statutory 7-year audit retention window.',
          ),
          _buildSection(
            number: '8',
            title: 'Your Rights Under Malaysian PDPA',
            body:
                'Under the Personal Data Protection Act 2010, you have the following rights regarding your personal data:\n\n'
                '• Right to Access: Request a copy of your personal data held in our active systems.\n\n'
                '• Right to Rectification: Request correction or updating of inaccurate or outdated personal details.\n\n'
                '• Right to Withdraw Consent: Opt-out of non-essential promotional messages while continuing to receive transactional order notifications.',
          ),
          _buildSection(
            number: '9',
            title: 'Updates to Privacy Policy',
            body:
                'We may update this Privacy Policy from time to time to reflect improvements in our technology, services, or legal obligations. When updates occur, the "Last Updated" timestamp will be revised. We encourage you to review this policy periodically.',
          ),
          _buildSection(
            number: '10',
            title: 'Contact Us & Data Inquiries',
            body:
                'If you have any questions, concerns, or requests regarding this Privacy Policy or how your personal data is handled, please contact our Data Protection and Support team:\n\n'
                '• Email: support@c2coffeeandcandle.com\n'
                '• In-App Support: Available under Profile > Settings > Contact Support. Submitted requests receive a ticket reference and are forwarded to C2 Support.\n'
                '• Operating Location: C2 Coffee + Candle (Broga, Kajang, Semenyih, Selangor, Malaysia)',
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildLastUpdated(String date) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.deepTeal.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.calendar_today_outlined,
              size: 15, color: AppColors.deepTeal),
          const SizedBox(width: 8),
          Text(
            'Last Updated: $date',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String number,
    required String title,
    required String body,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: AppColors.deepTeal,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  number,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            body,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14.5,
              color: Colors.black87,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}
