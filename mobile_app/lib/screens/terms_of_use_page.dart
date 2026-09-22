import 'package:flutter/material.dart';
import '../utils/app_colors.dart';
import '../widgets/app_page_shell.dart';

class TermsOfUsePage extends StatelessWidget {
  const TermsOfUsePage({super.key});

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'TERMS & CONDITIONS',
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
            title: 'Acceptance of Terms & Operational Scope',
            body:
                'By downloading, accessing, or using the C2 Coffee mobile application ("App"), you agree to these Terms and Conditions ("Terms"). The App is operated by C2 Coffee ("C2 Coffee + Candle", "we", "us", or "our") for self-pickup ordering, closed-loop prepaid C2 Tokens, loyalty cup tracking, and promotional rewards at participating C2 Coffee outlets. If you do not agree, do not use the App.',
          ),
          _buildSection(
            number: '2',
            title: 'Account Registration & Authentication',
            body:
                '2.1 Account creation requires a valid email address and Malaysian mobile phone number. Authentication is conducted using an email One-Time Password (OTP) sent to the email address registered to your account.\n\n'
                '2.2 Keep access to your email account and App session secure. Tell us promptly through Contact Support if you believe your account has been accessed without permission. We may take reasonable steps to protect the account while we investigate.\n\n'
                '2.3 You agree to provide true, accurate, and current information during registration (including full name, contact details, and optional birthday for reward verification). Any change to the email address on your profile requires verification of a code sent to the proposed new address before it takes effect.',
          ),
          _buildSection(
            number: '3',
            title: 'Menu, Customizations & Store Orders',
            body:
                '3.1 All beverage items (Coffee Craft, Barista Craft, Pour Over, Mocktails, Matcha, Chocolate, Coffee, Flavoured Coffee), pastries, merchandise, and candles are subject to real-time store availability.\n\n'
                '3.2 Handcrafted drinks are customized according to your specifications (such as choice of coffee beans, espresso shot count, choice of milk, temperature, ice level, sweetness, and sparkling mixer). Once an order enters preparation, customizations cannot be modified.\n\n'
                '3.3 All orders placed on the App are for Store Self-Pickup only. Delivery and courier dispatch are not supported at this time.',
          ),
          _buildSection(
            number: '4',
            title: 'Token Checkout & Payment Gateway Security',
            body:
                '4.1 Menu item checkout in the App is completed using prepaid C2 Tokens only. Direct cash, FPX, debit card, credit card, or third-party wallet checkout for menu items is not supported inside the App at this time.\n\n'
                '4.2 Where online token top-up is offered, it is processed by an authorised payment gateway. The available payment methods and token packages are shown in the App before a top-up session is created.\n\n'
                '4.3 C2 Coffee does not capture, process, log, or store credit/debit card numbers (PAN), CVV security codes, or banking credentials in the App.',
          ),
          _buildSection(
            number: '5',
            title: 'C2 Token System (Closed-Loop Prepaid Balance)',
            body:
                '5.1 "C2 Token" is a closed-loop prepaid stored-value balance intended strictly for member purchases at participating C2 Coffee stores. The conversion valuation is fixed at 1 C2 Token = RM 1.00.\n\n'
                '5.2 C2 Tokens enable members to purchase menu items at discounted member token prices structured by membership tier (Kawan, Dilamun, Ketagih, Legend).\n\n'
                '5.3 Closed-Loop Restrictions: C2 Tokens have no external cash value, cannot be redeemed for physical currency, cannot be transferred peer-to-peer (P2P) to other user accounts, and cannot be used outside C2 Coffee.\n\n'
                '5.4 Token top-ups are generally final once successfully credited to your account ledger. This does not affect rights that cannot be excluded under applicable law, or our handling of verified duplicate charges and technical billing errors.',
          ),
          _buildSection(
            number: '6',
            title: 'Loyalty Cups, Membership Tiers & Vouchers',
            body:
                '6.1 Every qualifying handcrafted beverage collected records 1 Cup toward your lifetime membership progression, unlocking higher tiers (Kawan -> Dilamun -> Ketagih -> Legend) and deeper token pricing discounts.\n\n'
                '6.2 Vouchers (including Welcome Drink Vouchers, Tier Progression Rewards, Referral Drink Rewards, and Promotional Campaign Vouchers) are subject to explicit validity periods, single-use checkout rules, primary non-stacking conditions, and specified drink category eligibility.\n\n'
                '6.3 Referral rewards are credited only after the new user collects their first qualifying order. Any automated abuse, multi-account farming, or fraudulent referral attempts will result in immediate forfeiture of rewards and account suspension.',
          ),
          _buildSection(
            number: '7',
            title: 'Store Pickup Fulfillment & Food Safety',
            body:
                '7.1 Customers are responsible for selecting the correct store location and arriving within the estimated pickup lead window (standard lead time: 15 minutes).\n\n'
                '7.2 Fresh food and beverages may deteriorate if not collected promptly. We may dispose of an uncollected order after the holding period shown in the App or communicated by the store. This does not affect rights that cannot be excluded under applicable law.',
          ),
          _buildSection(
            number: '8',
            title: 'Cancellations, Refunds & Billing Queries',
            body:
                '8.1 Customers may freely edit the cart before checkout. After checkout, an order may be cancelled in the App only while it remains unprepared. Once the store starts preparation, customer self-cancellation is not available.\n\n'
                '8.2 In the event of store unavailability, equipment breakdown, out-of-stock items, duplicate billing, or a verified technical issue, C2 Coffee store management or authorized administrators may cancel, refund, or return tokens through official administrative channels.\n\n'
                '8.3 Please submit a billing or payment discrepancy through Profile > Settings > Contact Support or support@c2coffeeandcandle.com, with the order reference and relevant evidence, within fourteen (14) days where reasonably possible. This requested timeframe does not limit rights that cannot be excluded under applicable law.',
          ),
          _buildSection(
            number: '9',
            title: 'Intellectual Property & User Conduct',
            body:
                '9.1 All trademarks, logos, brand names ("Mont Broga", "Shakerato Bianco", "Senja Di Broga", "Dato Blend", "Datin Blend", "C2 Coffee + Candle"), graphics, imagery, and software code are the proprietary intellectual property of C2 Coffee.\n\n'
                '9.2 Users shall not reverse engineer, decompile, scrape, or exploit the App for unauthorized commercial gains or interfere with server integrity.',
          ),
          _buildSection(
            number: '10',
            title: 'Modifications, Governing Law & Jurisdiction',
            body:
                '10.1 We may revise these Terms to reflect changes to our services, legal obligations, or security requirements. The updated version will show a revised date. Where required by law, we will provide additional notice or seek consent before a material change takes effect.\n\n'
                '10.2 These Terms are governed by the laws of Malaysia. Nothing in these Terms limits consumer rights or remedies that cannot be excluded under applicable law.',
          ),
          _buildSection(
            number: '11',
            title: 'Customer Support & Inquiries',
            body:
                'For assistance with store pickup orders, prepaid C2 Tokens, membership rewards, billing inquiries, or privacy requests, use Profile > Settings > Contact Support or email support@c2coffeeandcandle.com. Do not send passwords, one-time passwords, full card details, or banking credentials to support.',
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
