import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../services/auth_api_service.dart';
import '../services/secure_session_service.dart';
import 'terms_of_use_page.dart';
import 'privacy_policy_page.dart';
import '../widgets/app_page_shell.dart';

class ContactSupportPage extends StatefulWidget {
  const ContactSupportPage({super.key});

  @override
  State<ContactSupportPage> createState() => _ContactSupportPageState();
}

class _ContactSupportPageState extends State<ContactSupportPage> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _orderIdController = TextEditingController();
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();

  String _selectedCategory = 'Billing & Payment Claims';
  bool _isSubmitting = false;
  final List<XFile> _attachments = [];

  final List<String> _categories = [
    'Billing & Payment Claims',
    'Order & Store Pickup Issue',
    'C2 Token & Prepaid Balance',
    'Loyalty Cups & Vouchers',
    'Account & Personal Data',
    'General Inquiry & Feedback',
  ];

  bool get _orderReferenceRequired => [
        'Billing & Payment Claims',
        'Order & Store Pickup Issue',
      ].contains(_selectedCategory);

  @override
  void dispose() {
    _orderIdController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    AppNotification.showSuccess(
      context,
      '$label copied to clipboard',
      icon: Icons.copy_rounded,
    );
  }

  String _attachmentMimeType(String name) {
    final extension = name.split('.').last.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'mov':
        return 'video/quicktime';
      default:
        return 'video/mp4';
    }
  }

  Future<void> _pickEvidence() async {
    if (_attachments.length >= 3) {
      AppNotification.showError(context, 'You can attach up to 3 files.');
      return;
    }
    final type = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading:
                  Icon(Icons.photo_library_outlined, color: AppColors.deepTeal),
              title: const Text('Add photo'),
              onTap: () => Navigator.pop(sheetContext, 'image'),
            ),
            ListTile(
              leading: Icon(Icons.videocam_outlined, color: AppColors.deepTeal),
              title: const Text('Add video'),
              onTap: () => Navigator.pop(sheetContext, 'video'),
            ),
          ],
        ),
      ),
    );
    if (type == null) return;

    final picker = ImagePicker();
    final file = type == 'image'
        ? await picker.pickImage(source: ImageSource.gallery, imageQuality: 85)
        : await picker.pickVideo(
            source: ImageSource.gallery,
            maxDuration: const Duration(seconds: 60),
          );
    if (file == null) return;

    final size = await file.length();
    final existingSizes =
        await Future.wait(_attachments.map((item) => item.length()));
    final total = existingSizes.fold<int>(0, (sum, item) => sum + item);
    if (size > 5 * 1024 * 1024 || total + size > 8 * 1024 * 1024) {
      if (mounted) {
        AppNotification.showError(
            context, 'Each file must be up to 5 MB, with 8 MB total.');
      }
      return;
    }
    if (mounted) setState(() => _attachments.add(file));
  }

  Future<List<SupportTicketAttachment>> _buildAttachments() async {
    return Future.wait(_attachments.map((file) async => SupportTicketAttachment(
          fileName: file.name,
          mimeType: _attachmentMimeType(file.name),
          bytes: await file.readAsBytes(),
        )));
  }

  void _submitTicket() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Please sign in again before contacting support.');
      }
      final ticket = await AuthApiService.instance.submitSupportTicket(
        accessToken: accessToken,
        category: _selectedCategory,
        orderReference: _orderIdController.text,
        subject: _subjectController.text,
        message: _messageController.text,
        attachments: await _buildAttachments(),
      );

      if (!mounted) return;
      _orderIdController.clear();
      _subjectController.clear();
      _messageController.clear();
      setState(() => _attachments.clear());

      showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            backgroundColor: Colors.white,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: Row(
              children: [
                Icon(Icons.check_circle, color: AppColors.deepTeal, size: 28),
                const SizedBox(width: 10),
                Text(
                  'Request Received',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Your support ticket has been registered successfully.',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Reference Ticket Number:',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        ticket.ticketNumber,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  ticket.message,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'Done',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
            ],
          );
        },
      );
    } on ApiException catch (error) {
      if (mounted) {
        AppNotification.showError(context, error.message);
      }
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
          context,
          'Unable to submit your request right now. Please try again shortly.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'CONTACT SUPPORT',
      onBack: () => Navigator.pop(context),
      backgroundColor: const Color(0xFFF9F9FB),
      bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Card
          _buildIntroBanner(),

          const SizedBox(height: 20),

          // Direct Support Channels
          Text(
            'Direct Channels',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 12),
          _buildDirectChannels(),

          const SizedBox(height: 24),

          // Submit Support Ticket Form
          Text(
            'Submit an Inquiry',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 12),
          _buildTicketForm(),

          const SizedBox(height: 24),

          // Legal Links Footer
          _buildLegalNotice(),

          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildIntroBanner() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.deepTeal,
              shape: BoxShape.circle,
            ),
            child: Image.asset(
              'assets/images/customer-service.png',
              width: 24,
              height: 24,
              color: Colors.white,
              errorBuilder: (context, error, stackTrace) => const Icon(
                Icons.support_agent_rounded,
                size: 24,
                color: Colors.white,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'We\'re here to help',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Have an issue with your pickup order, prepaid C2 tokens, or billing? Reach out to our dedicated support team.',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black87,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDirectChannels() {
    return Column(
      children: [
        // WhatsApp Hotline
        _buildChannelCard(
          icon: Icons.chat_bubble_outline_rounded,
          iconBg: const Color(0xFFE8F5E9),
          iconColor: const Color(0xFF2E7D32),
          title: 'WhatsApp Support',
          subtitle: '+60 11-6379 3812',
          badgeText: '8:00 AM – 10:00 PM',
          onTap: () => _copyToClipboard('+60 11-6379 3812', 'WhatsApp Number'),
          actionText: 'Copy',
        ),

        const SizedBox(height: 12),

        // Email Support
        _buildChannelCard(
          icon: Icons.email_outlined,
          iconBg: const Color(0xFFE0F2F1),
          iconColor: AppColors.deepTeal,
          title: 'Official Email Support',
          subtitle: 'support@c2coffeeandcandle.com',
          badgeText: 'Response < 24h',
          onTap: () => _copyToClipboard(
              'support@c2coffeeandcandle.com', 'Support Email'),
          actionText: 'Copy',
        ),

        const SizedBox(height: 12),

        // Store Locations
        _buildChannelCard(
          icon: Icons.storefront_outlined,
          iconBg: const Color(0xFFFFF3E0),
          iconColor: AppColors.accent,
          title: 'Participating Outlets',
          subtitle: 'Broga, Kajang, Semenyih',
          badgeText: 'Self-Pickup Only',
          onTap: null,
          actionText: null,
        ),
      ],
    );
  }

  Widget _buildChannelCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String subtitle,
    required String badgeText,
    required VoidCallback? onTap,
    required String? actionText,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppColors.border, width: 0.8),
                  ),
                  child: Text(
                    badgeText,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null && actionText != null) ...[
            const SizedBox(width: 10),
            GestureDetector(
              onTap: onTap,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.surfaceMid,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  actionText,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTicketForm() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Category Selector
            const Text(
              'Issue Category',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF9F9FB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _selectedCategory,
                  isExpanded: true,
                  icon: Icon(Icons.keyboard_arrow_down,
                      color: AppColors.deepTeal),
                  items: _categories.map((cat) {
                    return DropdownMenuItem<String>(
                      value: cat,
                      child: Text(
                        cat,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 15,
                          color: Colors.black87,
                        ),
                      ),
                    );
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _selectedCategory = val;
                      });
                    }
                  },
                ),
              ),
            ),

            const SizedBox(height: 14),

            // Order reference is mandatory only for order and refund investigations.
            const Text(
              'Order Reference',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _orderIdController,
              decoration: InputDecoration(
                hintText:
                    'Required for order or refund issues, e.g. C2-260904-JUQTQL',
                hintStyle:
                    const TextStyle(fontFamily: 'Afacad', color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFFF9F9FB),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.deepTeal, width: 1.5),
                ),
              ),
              validator: (value) {
                if (_orderReferenceRequired &&
                    (value == null || value.trim().isEmpty)) {
                  return 'Enter the order reference from My Order for this issue.';
                }
                return null;
              },
            ),

            const SizedBox(height: 14),

            const Text(
              'Photo or Video Evidence (Optional)',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Up to 3 files. Maximum 5 MB each and 8 MB total. Videos up to 60 seconds.',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _isSubmitting ? null : _pickEvidence,
              icon: const Icon(Icons.attach_file_rounded),
              label: const Text('Add photo or video'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.deepTeal,
                side: BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
            if (_attachments.isNotEmpty) ...[
              const SizedBox(height: 8),
              ..._attachments.map(
                (file) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _attachmentMimeType(file.name).startsWith('image/')
                              ? Icons.image_outlined
                              : Icons.videocam_outlined,
                          size: 18,
                          color: AppColors.deepTeal,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            file.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontFamily: 'Afacad', fontSize: 13),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Remove attachment',
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(Icons.close_rounded, size: 18),
                          onPressed: _isSubmitting
                              ? null
                              : () => setState(() => _attachments.remove(file)),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 14),

            // Subject
            const Text(
              'Subject',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _subjectController,
              decoration: InputDecoration(
                hintText: 'Brief summary of your inquiry',
                hintStyle:
                    const TextStyle(fontFamily: 'Afacad', color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFFF9F9FB),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.deepTeal, width: 1.5),
                ),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter a subject';
                }
                return null;
              },
            ),

            const SizedBox(height: 14),

            // Message / Description
            const Text(
              'Message Details',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 6),
            TextFormField(
              controller: _messageController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText:
                    'Please describe your concern or inquiry with as much detail as possible...',
                hintStyle:
                    const TextStyle(fontFamily: 'Afacad', color: Colors.grey),
                filled: true,
                fillColor: const Color(0xFFF9F9FB),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: AppColors.deepTeal, width: 1.5),
                ),
              ),
              validator: (value) {
                if (value == null || value.trim().length < 10) {
                  return 'Please provide more details (at least 10 characters)';
                }
                return null;
              },
            ),

            const SizedBox(height: 18),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitTicket,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.deepTeal,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.2,
                        ),
                      )
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.send_rounded,
                              color: Colors.white, size: 18),
                          SizedBox(width: 8),
                          Text(
                            'Submit Support Request',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 16,
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
    );
  }

  Widget _buildLegalNotice() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const TermsOfUsePage()),
                ),
                child: Text(
                  'Terms & Conditions',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8),
                child: Text('•', style: TextStyle(color: Colors.grey)),
              ),
              GestureDetector(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PrivacyPolicyPage()),
                ),
                child: Text(
                  'Privacy Policy',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Governed by the laws of Malaysia & Personal Data Protection Act 2010.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
}
