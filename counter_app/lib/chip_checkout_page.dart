import 'dart:async';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'app_colors.dart';

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
  late final WebViewController _controller;
  Timer? _statusTimer;
  bool _checking = false;
  int _pageProgress = 0;
  String _statusMessage = 'Waiting for CHIP to confirm payment…';
  bool _terminalFailure = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) setState(() => _pageProgress = progress);
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri?.scheme == 'https') return NavigationDecision.navigate;
            if (mounted) {
              setState(() {
                _statusMessage = 'An unsafe payment-page link was blocked.';
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
    _statusTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _pollStatus(),
    );
    unawaited(_pollStatus());
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
            if (_pageProgress < 100)
              LinearProgressIndicator(value: _pageProgress / 100),
            Expanded(child: WebViewWidget(controller: _controller)),
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
}
