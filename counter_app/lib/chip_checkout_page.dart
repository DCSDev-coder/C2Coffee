import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_colors.dart';
import 'payment_navigation_policy.dart';

class ChipCheckoutPage extends StatefulWidget {
  const ChipCheckoutPage({
    super.key,
    required this.checkoutUri,
    required this.orderRef,
    required this.fetchStatus,
  });

  final Uri checkoutUri;
  final String orderRef;
  final Future<Map<String, dynamic>> Function() fetchStatus;

  @override
  State<ChipCheckoutPage> createState() => _ChipCheckoutPageState();
}

class _ChipCheckoutPageState extends State<ChipCheckoutPage> {
  WebViewController? _controller;
  Timer? _statusTimer;
  bool _checking = false;
  int _pageProgress = 0;
  String _statusMessage = 'Waiting for CHIP to confirm payment…';
  bool _terminalFailure = false;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb) {
      _controller = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (progress) {
              if (mounted) setState(() => _pageProgress = progress);
            },
            onNavigationRequest: (request) {
              final uri = Uri.tryParse(request.url);
              if (isTrustedPaymentWebViewUri(uri)) {
                return NavigationDecision.navigate;
              }
              if (mounted) {
                setState(() {
                  _statusMessage =
                      'A payment-page link outside the approved provider was blocked.';
                });
              }
              return NavigationDecision.prevent;
            },
            onWebResourceError: (error) {
              if (!mounted || error.isForMainFrame != true) return;
              setState(() {
                _statusMessage =
                    'The payment page could not load. Checking payment status automatically…';
              });
            },
          ),
        )
        ..loadRequest(widget.checkoutUri);
    } else {
      unawaited(_openPaymentWindow());
    }

    _statusTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _pollStatus(),
    );
    unawaited(_pollStatus());
  }

  Future<void> _openPaymentWindow() async {
    try {
      if (await canLaunchUrl(widget.checkoutUri)) {
        await launchUrl(
          widget.checkoutUri,
          mode: LaunchMode.externalApplication,
        );
      }
    } catch (_) {}
  }

  Future<void> _pollStatus() async {
    if (_checking || _terminalFailure || !mounted) return;
    _checking = true;
    try {
      final status = await widget.fetchStatus();
      if (!mounted) return;
      if (status['payment_status'] == 'paid' || status['status'] == 'paid') {
        _statusTimer?.cancel();
        Navigator.of(context).pop(true);
        return;
      }
      if (['failed', 'cancelled'].contains(status['payment_status']) ||
          ['payment_failed', 'cancelled'].contains(status['status'])) {
        _statusTimer?.cancel();
        setState(() {
          _terminalFailure = true;
          _statusMessage =
              'CHIP did not confirm this payment. No paid order was created.';
        });
      } else {
        setState(() {
          _statusMessage = 'Waiting for CHIP to confirm payment…';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _statusMessage =
              'Connection interrupted. Payment status will be checked again automatically.';
        });
      }
    } finally {
      _checking = false;
    }
  }

  Future<void> _requestClose() async {
    if (_terminalFailure) {
      if (mounted) Navigator.of(context).pop(false);
      return;
    }
    final close = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Stop waiting for payment?'),
        content: const Text(
          'Only CHIP can confirm payment. If the customer has already paid, do not start another checkout; check the order list first.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep waiting'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Close payment'),
          ),
        ],
      ),
    );
    if (close == true && mounted) Navigator.of(context).pop(false);
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(_requestClose());
      },
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            onPressed: _requestClose,
            icon: const Icon(Icons.close_rounded),
            tooltip: 'Close payment',
          ),
          title: const Text('Secure payment'),
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
        ),
        body: Column(
          children: [
            if (!kIsWeb && _pageProgress < 100)
              LinearProgressIndicator(value: _pageProgress / 100),
            Expanded(
              child: kIsWeb
                  ? _buildWebCheckoutView()
                  : (_controller != null
                      ? WebViewWidget(controller: _controller!)
                      : const SizedBox.shrink()),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 18),
              color: _terminalFailure
                  ? const Color(0xFFFFF1F0)
                  : const Color(0xFFF2F8F5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _statusMessage,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: _terminalFailure
                          ? const Color(0xFFB42318)
                          : AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Order ${widget.orderRef}. The order and receipt are released only after server verification.',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      color: Colors.black54,
                    ),
                  ),
                  if (_terminalFailure) ...[
                    const SizedBox(height: 10),
                    FilledButton(
                      onPressed: _requestClose,
                      child: const Text('Close'),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWebCheckoutView() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          padding: const EdgeInsets.all(32),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.12),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.08),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.qr_code_2_rounded,
                  size: 42,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Order ${widget.orderRef}',
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Complete the payment in the secure CHIP gateway window. Once payment is confirmed, this screen will automatically finalize the order.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  color: Colors.black87,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 28),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: _openPaymentWindow,
                  icon: const Icon(Icons.open_in_new_rounded, size: 20),
                  label: const Text(
                    'Open CHIP Payment Window',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Flexible(
                    child: Text(
                      _statusMessage,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
