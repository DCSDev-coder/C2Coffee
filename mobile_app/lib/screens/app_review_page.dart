import 'package:flutter/material.dart';

import '../services/auth_api_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';
import 'loading_order_page.dart';

class AppReviewPage extends StatefulWidget {
  const AppReviewPage({super.key});

  @override
  State<AppReviewPage> createState() => _AppReviewPageState();
}

class _AppReviewPageState extends State<AppReviewPage> {
  final _formKey = GlobalKey<FormState>();
  final _messageController = TextEditingController();
  int _rating = 0;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submitReview() async {
    if (_isSubmitting || !(_formKey.currentState?.validate() ?? false)) return;
    if (_rating == 0) {
      AppNotification.showError(context, 'Please select a rating first.');
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException('Please sign in again before sending feedback.');
      }

      final review = await AuthApiService.instance.submitSupportTicket(
        accessToken: accessToken,
        category: 'General Inquiry & Feedback',
        subject: 'Mobile app review ($_rating/5)',
        message: 'Rating: $_rating/5\n\n${_messageController.text.trim()}',
      );

      if (!mounted) return;
      _messageController.clear();
      setState(() => _rating = 0);
      await _showSubmittedDialog(review);
    } on ApiException catch (error) {
      if (!mounted) return;
      AppNotification.showError(
        context,
        friendlyCustomerErrorMessage(
          error,
          fallback:
              'Unable to send your review right now. Please try again shortly.',
        ),
      );
    } catch (_) {
      if (!mounted) return;
      AppNotification.showError(
        context,
        'Unable to send your review right now. Please try again shortly.',
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Future<void> _showSubmittedDialog(SupportTicketResult review) {
    return showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.deepTeal),
            const SizedBox(width: 10),
            const Expanded(child: Text('Thank you for your review')),
          ],
        ),
        content: Text(
          'Your feedback was sent to C2 Support. Reference: ${review.ticketNumber}',
          style:
              const TextStyle(fontFamily: 'Afacad', fontSize: 16, height: 1.35),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: Text('Done', style: TextStyle(color: AppColors.deepTeal)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppPageShell(
      title: 'SHARE FEEDBACK',
      onBack: () => InteractiveFillingLoader.showPop(context),
      backgroundColor: const Color(0xFFF9F9FB),
      bodyPadding: const EdgeInsets.fromLTRB(20, 22, 20, 36),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Help us improve C2 Coffee',
              style: TextStyle(
                fontFamily: 'Recoleta',
                fontSize: 25,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Tell us what worked, what went wrong, or what you would like us to improve. Your review goes directly to C2 Support.',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 16,
                height: 1.35,
                color: Colors.black54,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'How would you rate the app?',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.brandText,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: List.generate(5, (index) {
                final selected = index < _rating;
                return IconButton(
                  tooltip: '${index + 1} star${index == 0 ? '' : 's'}',
                  onPressed: _isSubmitting
                      ? null
                      : () => setState(() => _rating = index + 1),
                  icon: Icon(
                    selected ? Icons.star_rounded : Icons.star_border_rounded,
                    size: 40,
                    color: selected ? AppColors.gold : AppColors.border,
                  ),
                );
              }),
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: _messageController,
              minLines: 6,
              maxLines: 10,
              maxLength: 4000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                labelText: 'Your review',
                hintText: 'What should we fix or improve?',
                alignLabelWithHint: true,
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide(color: AppColors.deepTeal, width: 1.5),
                ),
              ),
              validator: (value) {
                final message = value?.trim() ?? '';
                if (message.length < 10) {
                  return 'Please enter at least 10 characters.';
                }
                return null;
              },
            ),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isSubmitting ? null : _submitReview,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send_rounded),
                label: Text(_isSubmitting ? 'Sending...' : 'Send Review'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.deepTeal,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      AppColors.deepTeal.withValues(alpha: 0.55),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'For urgent payment, order, or account issues, use Contact Support so we can assist you directly.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13.5,
                height: 1.3,
                color: Colors.black45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
