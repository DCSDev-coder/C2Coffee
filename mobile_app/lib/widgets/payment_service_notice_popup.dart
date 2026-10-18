import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/notification_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';

Future<void> showPaymentServiceNoticePopup(
  BuildContext context,
  PaymentServiceNotice notice,
) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _PaymentServiceNoticeDialog(notice: notice),
  );
}

class _PaymentServiceNoticeDialog extends StatefulWidget {
  final PaymentServiceNotice notice;

  const _PaymentServiceNoticeDialog({required this.notice});

  @override
  State<_PaymentServiceNoticeDialog> createState() =>
      _PaymentServiceNoticeDialogState();
}

class _PaymentServiceNoticeDialogState
    extends State<_PaymentServiceNoticeDialog> {
  bool _dismissing = false;

  Future<void> _dontRemind() async {
    setState(() => _dismissing = true);
    try {
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw Exception('Missing session');
      }
      await NotificationService.instance.dismissPaymentServiceNoticePopup(
        accessToken: accessToken,
        noticeId: widget.notice.id,
      );
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (!mounted) return;
      AppNotification.showError(
        context,
        'We could not save this preference. Please try again.',
      );
      setState(() => _dismissing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = DateFormat('d MMM yyyy, h:mm a');
    final notice = widget.notice;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      icon: Icon(
        Icons.warning_amber_rounded,
        color: Colors.amber.shade800,
        size: 38,
      ),
      title: Text(
        notice.title,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontFamily: 'Recoleta',
          fontWeight: FontWeight.bold,
          color: AppColors.deepTeal,
        ),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            notice.message,
            style: const TextStyle(fontFamily: 'Afacad', fontSize: 16, height: 1.35),
          ),
          const SizedBox(height: 14),
          Text(
            'Affected payment method',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          Text(
            notice.paymentMethodLabel,
            style: const TextStyle(fontFamily: 'Afacad', fontSize: 15),
          ),
          const SizedBox(height: 10),
          Text(
            '${formatter.format(notice.startsAt)}\n– ${formatter.format(notice.endsAt)}',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              fontWeight: FontWeight.w600,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'This notice remains in Notifications until the maintenance window ends.',
            style: TextStyle(fontFamily: 'Afacad', fontSize: 14, color: Colors.black54),
          ),
        ],
      ),
      actionsAlignment: MainAxisAlignment.center,
      actions: [
        TextButton(
          onPressed: _dismissing ? null : () => Navigator.pop(context),
          child: const Text('Close for now'),
        ),
        FilledButton(
          onPressed: _dismissing ? null : _dontRemind,
          style: FilledButton.styleFrom(backgroundColor: AppColors.deepTeal),
          child: _dismissing
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
              : const Text("Don't remind me"),
        ),
      ],
    );
  }
}
