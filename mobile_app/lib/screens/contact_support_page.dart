import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/auth_api_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import 'loading_order_page.dart';
import 'privacy_policy_page.dart';
import 'terms_of_use_page.dart';

class ContactSupportPage extends StatefulWidget {
  const ContactSupportPage({super.key});

  @override
  State<ContactSupportPage> createState() => _ContactSupportPageState();
}

class _ContactSupportPageState extends State<ContactSupportPage> {
  static const String _supportPhoneDisplay = '+60 12-610 6907';
  static const String _supportPhoneDial = '+60126106907';
  static const String _supportWhatsAppDigits = '60126106907';
  static const String _supportEmail = 'support@c2coffeeandcandle.com';
  static const String _outletName = 'C2 Coffee Eco Forest';
  static const String _outletAddress =
      '42-1, Jalan Eco Forest 6/1C, Eco Forest, 43500 Semenyih, Selangor';

  final _formKey = GlobalKey<FormState>();
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _orderIdController = TextEditingController();
  final TextEditingController _subjectController = TextEditingController();
  final TextEditingController _messageController = TextEditingController();

  String _selectedCategory = 'Billing & Payment Claims';
  bool _isSubmitting = false;
  bool _showScrollToTop = false;
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
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScroll);
    _scrollController.dispose();
    _orderIdController.dispose();
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    final shouldShow =
        _scrollController.hasClients && _scrollController.offset > 300;
    if (shouldShow != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShow);
    }
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 450),
      curve: Curves.easeOutCubic,
    );
  }

  Future<bool> _tryLaunchUri(
    Uri uri, {
    LaunchMode mode = LaunchMode.externalApplication,
  }) async {
    try {
      return await launchUrl(uri, mode: mode);
    } catch (_) {
      return false;
    }
  }

  Future<void> _copyToClipboard(String value, String label) async {
    await Clipboard.setData(ClipboardData(text: value));
    if (!mounted) return;
    AppNotification.showSuccess(context, '$label copied to clipboard.');
  }

  Future<void> _openWhatsAppSupport() async {
    const prefill = 'Hi C2 Coffee Support, I would like assistance with ';
    final nativeUri = Uri.parse(
      'whatsapp://send?phone=$_supportWhatsAppDigits&text=${Uri.encodeComponent(prefill)}',
    );
    final webUri = Uri.https(
      'wa.me',
      '/$_supportWhatsAppDigits',
      {'text': prefill},
    );

    if (await _tryLaunchUri(nativeUri)) return;
    if (await _tryLaunchUri(webUri)) return;
    if (await _tryLaunchUri(webUri, mode: LaunchMode.platformDefault)) return;

    await _copyToClipboard(_supportPhoneDisplay, 'WhatsApp number');
  }

  Future<void> _callSupportPhone() async {
    final telUri = Uri(scheme: 'tel', path: _supportPhoneDial);
    if (await _tryLaunchUri(telUri)) return;
    if (await _tryLaunchUri(telUri, mode: LaunchMode.platformDefault)) return;

    await _copyToClipboard(_supportPhoneDisplay, 'Support phone number');
  }

  Future<void> _openEmailSupport() async {
    final subject = Uri.encodeComponent('C2 Coffee Support Request');
    final mailtoUri = Uri.parse('mailto:$_supportEmail?subject=$subject');

    if (await _tryLaunchUri(mailtoUri)) return;
    if (await _tryLaunchUri(mailtoUri, mode: LaunchMode.platformDefault)) {
      return;
    }

    await _copyToClipboard(_supportEmail, 'Support email address');
  }

  Future<void> _openGoogleMaps() async {
    final encodedAddress = Uri.encodeComponent(_outletAddress);
    final nativeMapsUri = Uri.parse('comgooglemaps://?q=$encodedAddress');
    final webMapsUri = Uri.https(
      'www.google.com',
      '/maps/search/',
      {
        'api': '1',
        'query': _outletAddress,
      },
    );

    if (await _tryLaunchUri(nativeMapsUri)) return;
    if (await _tryLaunchUri(webMapsUri)) return;
    if (await _tryLaunchUri(webMapsUri, mode: LaunchMode.platformDefault)) {
      return;
    }

    if (mounted) {
      AppNotification.showError(
        context,
        'Unable to open Google Maps. Address copied instead.',
      );
      await Clipboard.setData(const ClipboardData(text: _outletAddress));
    }
  }

  Future<void> _openWaze() async {
    final encodedAddress = Uri.encodeComponent(_outletAddress);
    final nativeWazeUri =
        Uri.parse('waze://?q=$encodedAddress&navigate=yes');
    final webWazeUri = Uri.https(
      'www.waze.com',
      '/ul',
      {
        'q': _outletAddress,
        'navigate': 'yes',
      },
    );

    if (await _tryLaunchUri(nativeWazeUri)) return;
    if (await _tryLaunchUri(webWazeUri)) return;
    if (await _tryLaunchUri(webWazeUri, mode: LaunchMode.platformDefault)) {
      return;
    }

    if (mounted) {
      AppNotification.showError(
        context,
        'Unable to open Waze. Address copied instead.',
      );
      await Clipboard.setData(const ClipboardData(text: _outletAddress));
    }
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'Attach Evidence',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.photo_library_outlined,
                    color: AppColors.deepTeal,
                  ),
                ),
                title: const Text(
                  'Choose Photo from Gallery',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'JPG, PNG, or WEBP up to 5 MB',
                  style: TextStyle(fontFamily: 'Afacad', fontSize: 14),
                ),
                onTap: () => Navigator.pop(sheetContext, 'image'),
              ),
              ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    Icons.videocam_outlined,
                    color: AppColors.deepTeal,
                  ),
                ),
                title: const Text(
                  'Choose Video from Gallery',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16.5,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: const Text(
                  'MP4 or MOV up to 60 seconds (max 5 MB)',
                  style: TextStyle(fontFamily: 'Afacad', fontSize: 14),
                ),
                onTap: () => Navigator.pop(sheetContext, 'video'),
              ),
            ],
          ),
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
    if (_isSubmitting) return;
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
        builder: (dialogContext) {
          return Dialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            insetPadding: const EdgeInsets.symmetric(horizontal: 22),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F5E9),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          color: Color(0xFF2E7D32),
                          size: 26,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Request Received',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Your support ticket has been registered successfully.',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Reference Ticket Number',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 13.5,
                                  color: Colors.black54,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                ticket.ticketNumber,
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 19,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.deepTeal,
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Copy ticket number',
                          onPressed: () => _copyToClipboard(
                            ticket.ticketNumber,
                            'Ticket number',
                          ),
                          icon: Icon(
                            Icons.copy_rounded,
                            size: 19,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    ticket.message,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15.5,
                      color: Colors.black54,
                      height: 1.35,
                    ),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(dialogContext),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.deepTeal,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: const Text(
                        'Done',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    } on ApiException catch (error) {
      if (mounted) {
        AppNotification.showError(
          context,
          friendlyCustomerErrorMessage(
            error,
            fallback:
                'Unable to submit your request right now. Please try again shortly.',
          ),
        );
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
      onBack: () => InteractiveFillingLoader.showPop(context),
      backgroundColor: const Color(0xFFF9F9FB),
      scrollController: _scrollController,
      overlay: Stack(
        children: [
          if (_showScrollToTop)
            Positioned(
              right: 18,
              bottom: 24 + MediaQuery.paddingOf(context).bottom,
              child: Semantics(
                button: true,
                label: 'Back to top',
                child: Material(
                  color: AppColors.deepTeal,
                  elevation: 5,
                  shadowColor: Colors.black26,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: _scrollToTop,
                    child: const SizedBox(
                      width: 48,
                      height: 48,
                      child: Icon(
                        Icons.keyboard_arrow_up_rounded,
                        color: Colors.white,
                        size: 30,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      bodyPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildIntroBanner(),
          const SizedBox(height: 22),
          Text(
            'Direct Channels',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 21,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Tap any channel below to chat, email, or navigate directly.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 12),
          _buildDirectChannels(),
          const SizedBox(height: 26),
          Text(
            'Submit an Inquiry',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 21,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Send a ticket directly to our support team with optional photo or video evidence.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 12),
          _buildTicketForm(),
          const SizedBox(height: 24),
          _buildLegalNotice(),
          const SizedBox(height: 36),
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
        border: Border.all(color: AppColors.border, width: 1.4),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(11),
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
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Have an issue with your pickup order, prepaid C2 tokens, or billing? Reach out to our dedicated support team.',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15.5,
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
        // WhatsApp Support
        _buildChannelCard(
          icon: Icons.chat_bubble_outline_rounded,
          iconBg: const Color(0xFFE8F5E9),
          iconColor: const Color(0xFF2E7D32),
          title: 'WhatsApp Support',
          contactLinkText: _supportPhoneDisplay,
          badgeText: '8:00 AM – 10:00 PM',
          onTap: _openWhatsAppSupport,
          onCopy: () =>
              _copyToClipboard(_supportPhoneDisplay, 'WhatsApp number'),
          secondaryActionLabel: 'Call',
          onSecondaryAction: _callSupportPhone,
          actionText: 'Chat',
          actionIcon: Icons.open_in_new_rounded,
        ),

        const SizedBox(height: 12),

        // Official Email Support
        _buildChannelCard(
          icon: Icons.email_outlined,
          iconBg: const Color(0xFFE0F2F1),
          iconColor: AppColors.deepTeal,
          title: 'Official Email Support',
          contactLinkText: _supportEmail,
          singleLineContact: true,
          badgeText: 'Email support',
          onTap: _openEmailSupport,
          onCopy: () =>
              _copyToClipboard(_supportEmail, 'Support email address'),
          actionText: 'Email',
          actionIcon: Icons.mail_outline_rounded,
        ),

        const SizedBox(height: 12),

        // Google Maps Outlet Location
        _buildChannelCard(
          icon: Icons.storefront_outlined,
          iconBg: const Color(0xFFFFF3E0),
          iconColor: AppColors.accent,
          title: _outletName,
          contactLinkText: _outletAddress,
          badgeText: 'Self-Pickup Only • Google Maps',
          onTap: _openGoogleMaps,
          onCopy: () => _copyToClipboard(_outletAddress, 'Outlet address'),
          actionText: 'Maps',
          actionIcon: Icons.map_outlined,
        ),

        const SizedBox(height: 12),

        // Waze Navigation
        _buildChannelCard(
          icon: Icons.navigation_outlined,
          iconBg: const Color(0xFFFFF3E0),
          iconColor: AppColors.accent,
          title: 'Navigate with Waze',
          contactLinkText: _outletAddress,
          badgeText: 'Turn-by-turn Navigation',
          onTap: _openWaze,
          onCopy: () => _copyToClipboard(_outletAddress, 'Outlet address'),
          actionText: 'Waze',
          actionIcon: Icons.near_me_outlined,
        ),
      ],
    );
  }

  Widget _buildChannelCard({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    required String contactLinkText,
    bool singleLineContact = false,
    required String badgeText,
    required VoidCallback onTap,
    required VoidCallback onCopy,
    String? secondaryActionLabel,
    VoidCallback? onSecondaryAction,
    required String actionText,
    required IconData actionIcon,
  }) {
    final linkWidget = Text(
      contactLinkText,
      style: TextStyle(
        fontFamily: 'Afacad',
        fontSize: 15.5,
        fontWeight: FontWeight.w600,
        color: AppColors.deepTeal,
        decoration: TextDecoration.underline,
        decorationColor: AppColors.deepTeal.withValues(alpha: 0.45),
        height: 1.3,
      ),
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.3),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          onLongPress: onCopy,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 3),
                      if (singleLineContact)
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: linkWidget,
                        )
                      else
                        linkWidget,
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: AppColors.border,
                                width: 0.9,
                              ),
                            ),
                            child: Text(
                              badgeText,
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                color: AppColors.deepTeal,
                              ),
                            ),
                          ),
                          if (secondaryActionLabel != null &&
                              onSecondaryAction != null)
                            InkWell(
                              onTap: onSecondaryAction,
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 3,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(
                                    color: Colors.grey.shade300,
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.phone_outlined,
                                      size: 13,
                                      color: AppColors.deepTeal,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      secondaryActionLabel,
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: AppColors.deepTeal,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          InkWell(
                            onTap: onCopy,
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: Colors.grey.shade300,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.copy_rounded,
                                    size: 12.5,
                                    color: Colors.black54,
                                  ),
                                  const SizedBox(width: 4),
                                  const Text(
                                    'Copy',
                                    style: TextStyle(
                                      fontFamily: 'Afacad',
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black54,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMid,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        actionText,
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: AppColors.deepTeal,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        actionIcon,
                        size: 14,
                        color: AppColors.deepTeal,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTicketForm() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.3),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF6E8),
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
              ),
              child: const Text(
                'For your security, do not send passwords, one-time passwords, full card details, bank credentials, or other unnecessary sensitive information.',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 15,
                  color: Colors.black87,
                  height: 1.3,
                ),
              ),
            ),
            const SizedBox(height: 16),
            // Category Selector
            const Text(
              'Issue Category',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 16,
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
                          fontSize: 17,
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
                fontSize: 16,
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
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Up to 3 files. Maximum 5 MB each and 8 MB total. Videos up to 60 seconds.',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 14,
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
                                fontFamily: 'Afacad', fontSize: 15),
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
                fontSize: 16,
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
                fontSize: 16,
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
              height: 50,
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
                    fontSize: 15,
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
                    fontSize: 15,
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
              fontSize: 14,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
}
