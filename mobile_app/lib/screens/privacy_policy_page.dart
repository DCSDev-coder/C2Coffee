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
          _buildLastUpdated('September 22, 2026'),
          const SizedBox(height: 16),
          _buildSection(
            number: '1',
            title: 'About This Policy',
            body:
                'C2 Coffee ("C2 Coffee + Candle", "we", "us", or "our") explains here how we handle personal data when you use our mobile application ("App") or contact us. This notice is intended to support our obligations under the Malaysian Personal Data Protection Act 2010 ("PDPA"). It does not limit rights that cannot be limited under applicable law.',
          ),
          _buildSection(
            number: '2',
            title: 'Personal Data We Collect',
            body:
                'We collect the data needed to provide ordering, closed-loop token balances, rewards, account support, and security:\n\n'
                '• Identity & Profile Data: Display name, mobile telephone number, email address, and an optional date of birth where you provide it for a birthday reward.\n\n'
                '• Contact & Authentication Data: Email address, Malaysian mobile telephone number, and email One-Time Password (OTP) verification records. A new email address is applied only after its verification code is confirmed.\n\n'
                '• Transaction Data: Store pickup orders, token top-up and debit ledger entries, payment references, voucher redemptions, referral associations, and transaction timestamps.\n\n'
                '• Payment Card Notice: We do NOT collect, process, or store credit/debit card numbers (PAN), CVV codes, or banking credentials in the App.\n\n'
                '• Device & Security Data: Device and session records used for account authentication, push-notification tokens if you enable notifications, and security logs such as IP address and user-agent information where recorded by our services.',
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
                '• Payment Gateway: an authorized provider that processes an online C2 Token top-up when you choose that option.\n\n'
                '• Email Delivery Service: authorized SMTP or transactional email infrastructure used to send account verification codes and service messages.\n\n'
                '• Cloud Infrastructure & Hosting: service providers that host or operate the systems needed to deliver the App.\n\n'
                '• Legal & Regulatory Authorities: When required by applicable Malaysian law, court order, or governmental authority.',
          ),
          _buildSection(
            number: '5',
            title: 'Data Retention',
            body:
                'We retain personal data only for as long as needed for the purposes in this policy, including legal, accounting, audit, dispute-resolution, and security requirements. When an account closure is requested, the current service sets a seven-year retention period for required financial and audit records. Temporary authentication records and revoked sessions are retained according to our operational security controls.',
          ),
          _buildSection(
            number: '6',
            title: 'Data Security & Storage Controls',
            body:
                'We use technical and organisational controls designed to protect personal data. No internet service can guarantee absolute security.\n\n'
                '• Encrypted Data Transmission: All data transferred between the App and our backend servers is encrypted using modern TLS/HTTPS protocols.\n\n'
                '• Access Controls: Access to operational systems is restricted to authorised personnel for their work.\n\n'
                '• Security Records: We keep security and audit records to investigate suspected unauthorised access, fraud, or service misuse.',
          ),
          _buildSection(
            number: '7',
            title: 'Account Closure & Data Deletion Workflow',
            body:
                '7.1 You can request account closure in Profile > Settings > Close Account. The request requires confirmation and a reason.\n\n'
                '7.2 When a closure request is accepted, active sessions are revoked and the account is marked for deletion. You will be signed out.\n\n'
                '7.3 We retain data that we must keep for legal, accounting, audit, security, or dispute-resolution purposes. This can include financial and token-ledger records for the applicable retention period.',
          ),
          _buildSection(
            number: '8',
            title: 'Your Rights Under Malaysian PDPA',
            body:
                'Under the Personal Data Protection Act 2010, you have the following rights regarding your personal data:\n\n'
                '• Right to Access: Request a copy of your personal data held in our active systems.\n\n'
                '• Right to Rectification: Request correction or updating of inaccurate or outdated personal details.\n\n'
                '• Right to Withdraw Consent or Prevent Processing: Ask us to stop a particular non-essential processing activity, including direct marketing, subject to applicable law and our ability to provide the service.\n\n'
                'To make a request, use Contact Support and select "Account & Personal Data", or email support@c2coffeeandcandle.com. We may need to verify your identity before acting on a request.',
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
                'If you have a privacy question or request, contact C2 Support:\n\n'
                '• Email: support@c2coffeeandcandle.com\n'
                '• In-App Support: Available under Profile > Settings > Contact Support. Submitted requests receive a ticket reference.\n\n'
                'Do not include passwords, one-time passwords, full card details, bank credentials, or other unnecessary sensitive information in a support request.',
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
