import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/pending_top_up_service.dart';
import '../services/secure_session_service.dart';
import '../services/payment_security.dart';

import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import 'loading_order_page.dart';
import '../widgets/app_page_shell.dart';
import '../widgets/app_tutorial.dart';
import '../widgets/payment_service_notice_popup.dart';

enum TransactionFilter { all, incoming, outgoing }

enum TopUpPaymentMethod { fpx, duitNowQr, card, ewallet }

class TopUpWalletPage extends StatefulWidget {
  const TopUpWalletPage({super.key});

  @override
  State<TopUpWalletPage> createState() => _TopUpWalletPageState();
}

class _TopUpWalletPageState extends State<TopUpWalletPage>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  static const int _initialTransactionLimit = 5;
  static const int _transactionPageStep = 5;

  final AppSessionService _session = AppSessionService.instance;
  final WalletTutorialTargets _tutorialTargets = WalletTutorialTargets();
  final ScrollController _scrollController = ScrollController();
  late final AnimationController _cardCircleController = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3600),
  )..repeat(reverse: true);
  static const bool _topUpGatewayEnabled = true;
  final TextEditingController _amountController =
      TextEditingController(text: '0');
  final FocusNode _amountFocusNode = FocusNode();
  int? _selectedPackageId;
  List<TokenTopUpPackage> _packages = const [];
  TopUpPaymentMethod? _paymentMethod;
  Set<TopUpPaymentMethod> _availablePaymentMethods = const {};
  bool _isPaymentMethodsLoading = true;
  String? _paymentMethodsError;
  bool _isStartingTopUp = false;
  String? _pendingTopUpRef;
  DateTime? _pendingTopUpExpiresAt;
  Timer? _pendingTopUpTimer;
  DateTime? _lastPendingTopUpRefresh;
  bool _isRefreshingPendingTopUp = false;
  bool _isTransactionsLoading = true;
  String? _transactionsError;
  List<WalletTransaction> _transactions = const [];
  TransactionFilter _selectedFilter = TransactionFilter.all;
  int _transactionDisplayLimit = _initialTransactionLimit;
  bool _showScrollToTop = false;

  List<WalletTransaction> get _filteredTransactions {
    final list = List<WalletTransaction>.from(_transactions);
    list.sort(_compareTransactionsNewestFirst);

    switch (_selectedFilter) {
      case TransactionFilter.all:
        return list;
      case TransactionFilter.incoming:
        return list.where((t) => t.isCredit).toList();
      case TransactionFilter.outgoing:
        return list.where((t) => !t.isCredit).toList();
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session.addListener(_handleSessionChanged);
    _amountFocusNode.addListener(_handleAmountFocusChanged);
    _scrollController.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await Future.wait([
        _loadWalletData(),
        _loadPaymentMethods(),
        _loadPackages(),
        _restorePendingTopUp(),
      ]);
      if (!mounted) return;
      final userId = _session.user?.id;
      if (userId != null) {
        if (AppTutorial.consumeWalletReplayRequest()) {
          await AppTutorial.showWallet(
            context,
            userId: userId,
            targets: _tutorialTargets,
          );
        } else {
          await AppTutorial.showWalletIfNeeded(
            context,
            userId: userId,
            targets: _tutorialTargets,
          );
        }
      }
      if (!mounted) return;
      await showPendingPaymentServiceNotice(context);
    });
  }

  Future<void> _restorePendingTopUp() async {
    final topUpRef = await PendingTopUpService.instance.read();
    if (!mounted || topUpRef == null || topUpRef.isEmpty) return;
    setState(() => _pendingTopUpRef = topUpRef);
    _startPendingTopUpTimer();
    await _refreshReturnedTopUp();
  }

  Future<void> _loadPackages() async {
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) return;
      final packages = await CustomerDataService.instance
          .getTopUpPackages(accessToken: token);
      if (mounted) setState(() => _packages = packages);
    } catch (_) {
      // Custom top-up remains available if preset packages cannot be loaded.
    }
  }

  @override
  void dispose() {
    _pendingTopUpTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _session.removeListener(_handleSessionChanged);
    _amountFocusNode.removeListener(_handleAmountFocusChanged);
    _scrollController.removeListener(_handleScroll);
    _cardCircleController.dispose();
    _scrollController.dispose();
    _amountFocusNode.dispose();
    _amountController.dispose();
    super.dispose();
  }

  void _handleScroll() {
    final shouldShow =
        _scrollController.hasClients && _scrollController.offset > 360;
    if (shouldShow != _showScrollToTop && mounted) {
      setState(() => _showScrollToTop = shouldShow);
    }
  }

  Future<void> _scrollToTop() async {
    if (!_scrollController.hasClients) return;
    await _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 480),
      curve: Curves.easeOutCubic,
    );
  }

  void _handleAmountFocusChanged() {
    if (_amountFocusNode.hasFocus && _amountController.text.trim() == '0') {
      _amountController.clear();
    } else if (!_amountFocusNode.hasFocus &&
        _amountController.text.trim().isEmpty) {
      _amountController.text = '0';
    }
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      if (_pendingTopUpRef != null) {
        _startPendingTopUpTimer();
        _refreshReturnedTopUp(force: true);
      }
    } else {
      _pendingTopUpTimer?.cancel();
      _pendingTopUpTimer = null;
    }
  }

  void _startPendingTopUpTimer() {
    if (_pendingTopUpRef == null || _pendingTopUpTimer != null) return;
    _pendingTopUpTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _pendingTopUpRef == null) return;
      final now = DateTime.now();
      if (_pendingTopUpExpiresAt != null &&
          !now.isBefore(_pendingTopUpExpiresAt!) &&
          (_lastPendingTopUpRefresh == null ||
              now.difference(_lastPendingTopUpRefresh!) >=
                  const Duration(seconds: 15))) {
        _refreshReturnedTopUp();
      } else {
        setState(() {});
      }
    });
  }

  String _pendingTopUpCountdownLabel() {
    final expiresAt = _pendingTopUpExpiresAt;
    if (expiresAt == null) return 'Checking payment expiry...';
    final remaining = expiresAt.difference(DateTime.now());
    if (remaining <= Duration.zero) {
      return 'Payment window expired. Checking status...';
    }
    final totalSeconds = remaining.inSeconds;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return 'Payment window: $minutes:${seconds.toString().padLeft(2, '0')} remaining';
  }

  Future<void> _refreshReturnedTopUp({bool force = false}) async {
    final topupRef = _pendingTopUpRef;
    if (topupRef == null || _isRefreshingPendingTopUp) return;
    final now = DateTime.now();
    if (!force &&
        _lastPendingTopUpRefresh != null &&
        now.difference(_lastPendingTopUpRefresh!) <
            const Duration(seconds: 15)) {
      return;
    }
    _isRefreshingPendingTopUp = true;
    _lastPendingTopUpRefresh = now;

    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) return;
      final topup = await CustomerDataService.instance.getOnlineTopUp(
        accessToken: token,
        topupRef: topupRef,
      );
      if (!mounted) return;
      _pendingTopUpExpiresAt = topup.expiresAt;
      if (const {
        'failed',
        'cancelled',
        'expired',
        'refunded',
        'refund_needs_review'
      }.contains(topup.status)) {
        await PendingTopUpService.instance.clear();
        if (!mounted) return;
        _pendingTopUpTimer?.cancel();
        _pendingTopUpTimer = null;
        setState(() {
          _pendingTopUpRef = null;
          _pendingTopUpExpiresAt = null;
        });
        if (topup.status == 'refunded') {
          AppNotification.showInfo(
            context,
            'This top-up was refunded and its tokens were removed.',
          );
        } else if (topup.status == 'refund_needs_review') {
          AppNotification.showInfo(
            context,
            'This refund is being reviewed because some credited tokens were already used.',
          );
        } else {
          AppNotification.showError(
            context,
            'That payment was not completed. You can start a new top-up.',
          );
        }
        return;
      }
      if (topup.status != 'paid') return;
      await PendingTopUpService.instance.clear();
      if (!mounted) return;
      _pendingTopUpTimer?.cancel();
      _pendingTopUpTimer = null;
      setState(() {
        _pendingTopUpRef = null;
        _pendingTopUpExpiresAt = null;
      });
      await _loadWalletData(forceSessionReload: true);
      if (mounted) {
        AppNotification.showSuccess(
          context,
          'Payment confirmed. Your C2 Tokens are ready.',
        );
      }
    } catch (_) {
      // The signed server callback remains the payment authority. The next
      // app resume or wallet refresh will try again if it has not arrived yet.
    } finally {
      _isRefreshingPendingTopUp = false;
    }
  }

  void _handleSessionChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _loadWalletData({bool forceSessionReload = false}) async {
    setState(() {
      _isTransactionsLoading = true;
      _transactionsError = null;
    });

    try {
      await _session.loadAuthenticatedState(force: forceSessionReload);
      final accessToken =
          await SecureSessionService.instance.getValidAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      final transactions =
          await CustomerDataService.instance.getWalletTransactions(
        accessToken: accessToken,
        limit: 50,
      );

      transactions.sort(_compareTransactionsNewestFirst);

      if (!mounted) return;
      setState(() {
        _transactions = transactions;
        _isTransactionsLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _transactionsError = _friendlyMessage(error);
        _isTransactionsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _transactionsError = 'Unable to load wallet transactions right now.';
        _isTransactionsLoading = false;
      });
    }
  }

  Future<void> _loadPaymentMethods() async {
    setState(() {
      _isPaymentMethodsLoading = true;
      _paymentMethodsError = null;
    });

    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) {
        throw ApiException('Missing access token.');
      }
      final result = await CustomerDataService.instance
          .getChipPaymentMethods(accessToken: token);
      final methods = result.methods
          .map(_paymentMethodFromApiValue)
          .whereType<TopUpPaymentMethod>()
          .toSet();

      if (!mounted) return;
      setState(() {
        _availablePaymentMethods = methods;
        _paymentMethod = methods.contains(_paymentMethod)
            ? _paymentMethod
            : _preferredPaymentMethod(methods);
        _isPaymentMethodsLoading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _availablePaymentMethods = const {};
        _paymentMethod = null;
        _paymentMethodsError = _friendlyMessage(error);
        _isPaymentMethodsLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _availablePaymentMethods = const {};
        _paymentMethod = null;
        _paymentMethodsError = 'Payment methods are temporarily unavailable.';
        _isPaymentMethodsLoading = false;
      });
    }
  }

  TopUpPaymentMethod? _paymentMethodFromApiValue(String value) {
    switch (value) {
      case 'fpx':
        return TopUpPaymentMethod.fpx;
      case 'duitnow_qr':
        return TopUpPaymentMethod.duitNowQr;
      case 'card':
        return TopUpPaymentMethod.card;
      case 'ewallet':
        return TopUpPaymentMethod.ewallet;
      default:
        return null;
    }
  }

  TopUpPaymentMethod? _preferredPaymentMethod(
    Set<TopUpPaymentMethod> methods,
  ) {
    for (final method in TopUpPaymentMethod.values) {
      if (methods.contains(method)) return method;
    }
    return null;
  }

  String _friendlyMessage(ApiException error) {
    switch (error.code) {
      case 'missing_access_token':
      case 'missing_bearer_token':
      case 'invalid_access_token':
      case 'session_not_found':
      case 'session_version_mismatch':
      case 'user_not_active':
        return 'Your session has expired. Please log in again.';
      case 'topup_gateway_unavailable':
        return 'Online top-up is temporarily unavailable. Please try again later.';
      case 'topup_email_required':
        return 'Add a verified email address in Settings before topping up online.';
      case 'token_balance_cap_exceeded':
        return 'This amount would exceed your C2 Token balance cap.';
      case 'topup_method_unavailable':
      case 'topup_bank_unavailable':
        return 'That payment option is unavailable. Please choose another one.';
      default:
        return friendlyCustomerErrorMessage(
          error,
          fallback: 'Unable to load token activity right now.',
        );
    }
  }

  String get _paymentMethodLabel {
    switch (_paymentMethod) {
      case TopUpPaymentMethod.fpx:
        return 'FPX Online Banking';
      case TopUpPaymentMethod.duitNowQr:
        return 'DuitNow QR';
      case TopUpPaymentMethod.card:
        return 'Credit or debit card';
      case TopUpPaymentMethod.ewallet:
        return 'E-wallet';
      case null:
        return 'Choose a payment method';
    }
  }

  String? get _paymentMethodApiValue {
    switch (_paymentMethod) {
      case TopUpPaymentMethod.fpx:
        return 'fpx';
      case TopUpPaymentMethod.duitNowQr:
        return 'duitnow_qr';
      case TopUpPaymentMethod.card:
        return 'card';
      case TopUpPaymentMethod.ewallet:
        return 'ewallet';
      case null:
        return null;
    }
  }

  int? get _enteredTopUpAmount {
    final amount = int.tryParse(_amountController.text.trim());
    return amount != null && amount >= 1 ? amount : null;
  }

  int get _remainingWalletCapacity {
    final remaining =
        _session.tokenCap - _session.tokenBalance - _session.tokenReserved;
    return remaining.clamp(0, _session.tokenCap);
  }

  int _packageAmount(TokenTopUpPackage package) {
    return double.tryParse(package.amountRm)?.round() ?? package.tokenAmount;
  }

  Future<void> _startTopUp() async {
    final amount = _enteredTopUpAmount;
    if (amount == null) {
      AppNotification.showError(
        context,
        'Enter a whole-ringgit amount of at least RM 1.',
      );
      return;
    }
    if (amount > _remainingWalletCapacity) {
      AppNotification.showError(
        context,
        'You can add up to $_remainingWalletCapacity tokens without exceeding your wallet cap.',
      );
      return;
    }
    if (_paymentMethod == null) {
      AppNotification.showError(
        context,
        'Choose an available payment method.',
      );
      return;
    }
    setState(() => _isStartingTopUp = true);
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) {
        throw ApiException('Missing access token.');
      }
      final topup = await CustomerDataService.instance.startChipTopUp(
        accessToken: token,
        amountRm: amount,
        paymentMethod: _paymentMethodApiValue!,
      );
      if (!isTrustedPaymentCheckoutUrl(topup.checkoutUrl)) {
        throw ApiException('The payment provider returned an untrusted URL.');
      }
      await PendingTopUpService.instance.save(topup.topupRef);
      if (mounted) {
        setState(() {
          _pendingTopUpRef = topup.topupRef;
          _pendingTopUpExpiresAt = topup.expiresAt;
        });
        _startPendingTopUpTimer();
      }
      if (!await launchUrl(Uri.parse(topup.checkoutUrl),
          mode: LaunchMode.externalApplication)) {
        await PendingTopUpService.instance.clear();
        _pendingTopUpTimer?.cancel();
        _pendingTopUpTimer = null;
        if (mounted) {
          setState(() {
            _pendingTopUpRef = null;
            _pendingTopUpExpiresAt = null;
          });
        }
        throw ApiException('Unable to open the payment page.');
      }
      if (mounted) {
        AppNotification.showInfo(
          context,
          'Complete payment in your browser, then return to C2 Coffee.',
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        AppNotification.showError(context, _friendlyMessage(error));
      }
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
          context,
          'Unable to start payment. Please try again.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isStartingTopUp = false);
      }
    }
  }

  String _formatTokenCount(int count) {
    return '$count ${count == 1 ? 'token' : 'tokens'}';
  }

  void _showTokenInfoDialog(BuildContext context) {
    final Color brandColor = AppColors.deepTeal;
    final int balance = _session.tokenBalance;
    final int reserved = _session.tokenReserved;
    final int cap = _session.tokenCap;
    final int remaining = _remainingWalletCapacity;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
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
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: brandColor.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(
                      Icons.account_balance_wallet_outlined,
                      color: brandColor,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Wallet Information',
                          style: TextStyle(
                            fontFamily: 'Recoleta',
                            fontSize: 23,
                            fontWeight: FontWeight.bold,
                            color: brandColor,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Everything you need to know about your C2 Token balance.',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            height: 1.3,
                            color: Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 6),
                  InkWell(
                    onTap: () => Navigator.pop(context),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 18,
                        color: Colors.black54,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      brandColor,
                      brandColor.withValues(alpha: 0.85),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.16),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.generating_tokens_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '1 C2 Token = RM 1.00',
                            style: TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 19,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'Instant cafe checkout & member tier rewards',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14,
                              color: Colors.white.withValues(alpha: 0.82),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    _buildInfoStatRow(
                      icon: Icons.check_circle_outline_rounded,
                      label: 'Available Balance',
                      value: _formatTokenCount(balance),
                      valueColor: brandColor,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Divider(
                          height: 1, color: Colors.grey.withValues(alpha: 0.2)),
                    ),
                    _buildInfoStatRow(
                      icon: Icons.hourglass_bottom_rounded,
                      label: 'Reserved for Orders',
                      value: _formatTokenCount(reserved),
                      valueColor: Colors.black87,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Divider(
                          height: 1, color: Colors.grey.withValues(alpha: 0.2)),
                    ),
                    _buildInfoStatRow(
                      icon: Icons.shield_outlined,
                      label: 'Maximum Wallet Cap',
                      value: _formatTokenCount(cap),
                      valueColor: Colors.black87,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Divider(
                          height: 1, color: Colors.grey.withValues(alpha: 0.2)),
                    ),
                    _buildInfoStatRow(
                      icon: Icons.add_circle_outline_rounded,
                      label: 'Remaining Top-Up Room',
                      value: _formatTokenCount(remaining),
                      valueColor: const Color(0xFF2E7D32),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: brandColor,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Text(
                    'Got It',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoStatRow({
    required IconData icon,
    required String label,
    required String value,
    required Color valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 19, color: Colors.black54),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15.5,
              fontWeight: FontWeight.w500,
              color: Colors.black54,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'Afacad',
            fontSize: 16.5,
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color brandColor = AppColors.deepTeal;

    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'WALLET',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: Colors.white,
        scrollController: _scrollController,
        onRefresh: () => _loadWalletData(forceSessionReload: true),
        trailing: GestureDetector(
          onTap: () => _showTokenInfoDialog(context),
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.info_outline_rounded,
              color: Colors.white,
              size: 21,
            ),
          ),
        ),
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
        bodyPadding: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildBalanceCard(),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Select Amount',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 23,
                      fontWeight: FontWeight.bold,
                      color: brandColor,
                    ),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '1 Token = RM 1',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                        color: brandColor,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (_packages.isNotEmpty) ...[
                Row(
                  key: _tutorialTargets.packagesKey,
                  children: List.generate(_packages.length, (i) {
                    final package = _packages[i];
                    final packageAmount = _packageAmount(package);
                    final selected = _selectedPackageId == package.id;
                    final available = packageAmount <= _remainingWalletCapacity;
                    return Expanded(
                      child: GestureDetector(
                        onTap: !available
                            ? null
                            : () {
                                FocusManager.instance.primaryFocus?.unfocus();
                                setState(() {
                                  _selectedPackageId = package.id;
                                  _amountController.text =
                                      packageAmount.toString();
                                });
                              },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          margin: EdgeInsets.only(
                            right: i < _packages.length - 1 ? 10 : 0,
                          ),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          decoration: BoxDecoration(
                            color: selected
                                ? brandColor
                                : available
                                    ? AppColors.surfaceLight
                                    : Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: selected
                                  ? brandColor
                                  : available
                                      ? AppColors.border
                                      : Colors.grey.shade300,
                              width: selected ? 2.0 : 1.3,
                            ),
                            boxShadow: selected
                                ? [
                                    BoxShadow(
                                      color:
                                          brandColor.withValues(alpha: 0.22),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Column(
                            children: [
                              Text(
                                'TOKENS',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: selected
                                      ? Colors.white70
                                      : available
                                          ? Colors.grey.shade600
                                          : Colors.grey.shade400,
                                  letterSpacing: 0.6,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$packageAmount',
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 28,
                                  fontWeight: FontWeight.bold,
                                  color: selected
                                      ? Colors.white
                                      : available
                                          ? brandColor
                                          : Colors.grey.shade400,
                                  height: 1.1,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: selected
                                      ? Colors.white.withValues(alpha: 0.18)
                                      : Colors.white.withValues(alpha: 0.7),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  'RM $packageAmount',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: selected
                                        ? Colors.white
                                        : Colors.grey.shade700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 16),
                Text(
                  'Or enter custom amount',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: brandColor,
                  ),
                ),
                const SizedBox(height: 8),
              ],
              TextField(
                key: _packages.isEmpty ? _tutorialTargets.packagesKey : null,
                controller: _amountController,
                focusNode: _amountFocusNode,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                enableInteractiveSelection: false,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (_) => setState(() => _selectedPackageId = null),
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: (_enteredTopUpAmount != null ||
                          _amountFocusNode.hasFocus)
                      ? Colors.black87
                      : Colors.grey.shade500,
                ),
                decoration: InputDecoration(
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 16, right: 12),
                    child: Center(
                      widthFactor: 1,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: brandColor.withValues(alpha: 0.10),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'TOKEN',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.7,
                            color: brandColor,
                          ),
                        ),
                      ),
                    ),
                  ),
                  suffixIcon: _enteredTopUpAmount != null
                      ? IconButton(
                          tooltip: 'Clear amount',
                          onPressed: () {
                            setState(() {
                              _selectedPackageId = null;
                              _amountController.text =
                                  _amountFocusNode.hasFocus ? '' : '0';
                            });
                          },
                          icon: Icon(
                            Icons.cancel_rounded,
                            color: Colors.grey.shade400,
                            size: 20,
                          ),
                        )
                      : null,
                  hintText: '0',
                  helperText:
                      'Minimum 1 token • Up to ${_formatTokenCount(_remainingWalletCapacity)} available for top-up',
                  helperMaxLines: 2,
                  errorText: _enteredTopUpAmount != null &&
                          _enteredTopUpAmount! > _remainingWalletCapacity
                      ? 'This exceeds your remaining wallet capacity (${_formatTokenCount(_remainingWalletCapacity)}).'
                      : null,
                  errorMaxLines: 2,
                  filled: true,
                  fillColor: AppColors.surfaceLight,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 18,
                    vertical: 16,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(
                      color: AppColors.border,
                      width: 1.5,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: brandColor, width: 1.8),
                  ),
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Colors.redAccent),
                  ),
                  focusedErrorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide:
                        const BorderSide(color: Colors.redAccent, width: 1.8),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              _buildTopUpCard(),
              const SizedBox(height: 28),
              Row(
                key: _tutorialTargets.historyKey,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    'Recent Transactions',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 23,
                      fontWeight: FontWeight.bold,
                      color: brandColor,
                    ),
                  ),
                  if (!_isTransactionsLoading &&
                      _transactionsError == null &&
                      _filteredTransactions.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '${_filteredTransactions.length} total',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: brandColor,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              _buildFilterPills(brandColor),
              const SizedBox(height: 16),
              if (_isTransactionsLoading)
                _buildTransactionsLoading()
              else if (_transactionsError != null)
                _buildTransactionsPlaceholder(message: _transactionsError!)
              else
                _buildTransactionsList(),
              const SizedBox(height: 52),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      key: _tutorialTargets.balanceKey,
      clipBehavior: Clip.hardEdge,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.deepTeal,
            AppColors.deepTeal.withValues(alpha: 0.84),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.deepTeal.withValues(alpha: 0.18),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        children: [
          AnimatedBuilder(
            animation: _cardCircleController,
            builder: (context, child) {
              final double t = Curves.easeInOutSine.transform(
                _cardCircleController.value,
              );
              return Positioned(
                right: -32 + (t * 22),
                top: -38 + (t * 18),
                child: Transform.scale(
                  scale: 0.94 + (t * 0.12),
                  child: child,
                ),
              );
            },
            child: Container(
              width: 132,
              height: 132,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 58,
                      height: 58,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.95),
                        borderRadius: BorderRadius.circular(18),
                      ),
                      padding: const EdgeInsets.all(11),
                      child: Image.asset('assets/images/wallet.png'),
                    ),
                    const SizedBox(width: 15),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'C2 TOKEN WALLET',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 0.9,
                              color: Colors.white.withValues(alpha: 0.76),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _formatTokenCount(_session.tokenBalance),
                            style: const TextStyle(
                              fontFamily: 'Recoleta',
                              fontSize: 29,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(14),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.16)),
                  ),
                  child: Text(
                    '${_session.tokenReserved} reserved  •  wallet cap ${_session.tokenCap}',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.86),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopUpCard() {
    final tokenAmount = _enteredTopUpAmount;
    final amountIsValid =
        tokenAmount != null && tokenAmount <= _remainingWalletCapacity;
    final canContinue = _topUpGatewayEnabled &&
        !_isStartingTopUp &&
        !_isPaymentMethodsLoading &&
        _pendingTopUpRef == null &&
        amountIsValid &&
        _paymentMethod != null;

    return Container(
      key: _tutorialTargets.paymentKey,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.035),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(Icons.add_rounded, color: AppColors.gold),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Add C2 Tokens',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
              if (tokenAmount != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    'RM $tokenAmount',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            !_topUpGatewayEnabled
                ? 'Online token top-up is not available yet. Please top up your C2 Tokens at the counter.'
                : _isPaymentMethodsLoading
                    ? 'Checking available payment methods securely...'
                    : _paymentMethodsError != null
                        ? _paymentMethodsError!
                        : _pendingTopUpRef != null
                            ? 'Your previous payment is still being confirmed. Return here after completing payment in the browser. ${_pendingTopUpCountdownLabel()}'
                            : tokenAmount == null
                                ? 'Enter how many tokens you want to add, then select how you want to pay.'
                                : !amountIsValid
                                    ? 'Enter an amount within your remaining wallet capacity.'
                                    : 'You will add ${_formatTokenCount(tokenAmount)} for RM $tokenAmount using $_paymentMethodLabel. Tokens are credited immediately once payment is confirmed.',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 18),
          if (_topUpGatewayEnabled) ...[
            Text(
              'Choose payment method',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 10),
            LayoutBuilder(builder: (context, constraints) {
              final cardWidth = (constraints.maxWidth - 10) / 2;
              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: TopUpPaymentMethod.values
                    .map((method) => SizedBox(
                          width: cardWidth,
                          child: _buildPaymentMethodCard(method),
                        ))
                    .toList(),
              );
            }),
            const SizedBox(height: 18),
          ],
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: canContinue ? _startTopUp : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepTeal,
                disabledBackgroundColor: AppColors.border,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                elevation: 0,
              ),
              child: Text(
                !_topUpGatewayEnabled
                    ? 'ONLINE TOP-UP COMING SOON'
                    : _isStartingTopUp
                        ? 'OPENING SECURE PAYMENT...'
                        : _isPaymentMethodsLoading
                            ? 'CHECKING PAYMENT METHODS...'
                            : _pendingTopUpRef != null
                                ? 'PAYMENT PENDING'
                                : 'CONTINUE TO PAYMENT',
                style: const TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 17,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.lock_outline_rounded,
                size: 13,
                color: Colors.grey.shade500,
              ),
              const SizedBox(width: 5),
              Text(
                'Secured by CHIP • Verified encrypted checkout',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  color: Colors.grey.shade500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodCard(TopUpPaymentMethod method) {
    final selected = _paymentMethod == method;
    final available = _availablePaymentMethods.contains(method);
    final presentation = switch (method) {
      TopUpPaymentMethod.fpx => ('FPX Banking', Icons.account_balance_outlined),
      TopUpPaymentMethod.duitNowQr => ('DuitNow QR', Icons.qr_code_rounded),
      TopUpPaymentMethod.card => ('Debit / Credit', Icons.credit_card_outlined),
      TopUpPaymentMethod.ewallet => (
          'E-Wallet',
          Icons.account_balance_wallet_outlined
        ),
    };

    return InkWell(
      onTap: !available || _isStartingTopUp
          ? null
          : () => setState(() => _paymentMethod = method),
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 108,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.deepTeal
              : available
                  ? AppColors.surfaceLight
                  : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected
                ? AppColors.deepTeal
                : available
                    ? AppColors.border
                    : Colors.grey.shade300,
            width: selected ? 1.8 : 1.2,
          ),
        ),
        child: Stack(
          children: [
            if (selected)
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 13,
                    color: Colors.white,
                  ),
                ),
              ),
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    presentation.$2,
                    size: 26,
                    color: selected
                        ? Colors.white
                        : available
                            ? AppColors.deepTeal
                            : Colors.grey.shade400,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    presentation.$1,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      height: 1.1,
                      color: selected
                          ? Colors.white
                          : available
                              ? AppColors.deepTeal
                              : Colors.grey.shade500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    available
                        ? (selected ? 'Selected' : 'Tap to select')
                        : 'Unavailable',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12,
                      color: selected
                          ? Colors.white.withValues(alpha: 0.78)
                          : Colors.grey.shade500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTransactionsLoading() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          CircularProgressIndicator(color: AppColors.deepTeal),
          const SizedBox(height: 12),
          Text(
            'Loading wallet transactions...',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 16,
              color: AppColors.deepTeal,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionsPlaceholder({required String message}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.receipt_long_outlined,
              size: 28,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No Activity Yet',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15.5,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPills(Color brandColor) {
    final filters = [
      (TransactionFilter.all, 'All'),
      (TransactionFilter.incoming, 'In (+)'),
      (TransactionFilter.outgoing, 'Out (-)'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters.map((item) {
          final isSelected = _selectedFilter == item.$1;
          return Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: InkWell(
              onTap: () {
                setState(() {
                  _selectedFilter = item.$1;
                  _transactionDisplayLimit = _initialTransactionLimit;
                });
              },
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? brandColor : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? brandColor : AppColors.border,
                    width: 1.2,
                  ),
                  boxShadow: [
                    if (isSelected)
                      BoxShadow(
                        color: brandColor.withValues(alpha: 0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                  ],
                ),
                child: Text(
                  item.$2,
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: isSelected ? Colors.white : Colors.black87,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTransactionsList() {
    final list = _filteredTransactions;
    if (list.isEmpty) {
      final msg = _selectedFilter == TransactionFilter.incoming
          ? 'No incoming (+) token transactions found.'
          : _selectedFilter == TransactionFilter.outgoing
              ? 'No outgoing (-) token transactions found.'
              : 'Your token top-ups and cafe purchases will appear here.';
      return _buildTransactionsPlaceholder(message: msg);
    }

    final visibleCount = list.length < _transactionDisplayLimit
        ? list.length
        : _transactionDisplayLimit;
    final visibleList = list.sublist(0, visibleCount);
    final remainingCount = list.length - visibleCount;
    final canCollapse = list.length > _initialTransactionLimit &&
        visibleCount > _initialTransactionLimit;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          for (var i = 0; i < visibleList.length; i++) ...[
            _buildTransactionRow(visibleList[i]),
            if (i < visibleList.length - 1 ||
                remainingCount > 0 ||
                canCollapse)
              Divider(
                height: 1,
                color: AppColors.border.withValues(alpha: 0.65),
                thickness: 1,
              ),
          ],
          if (remainingCount > 0 || canCollapse)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (remainingCount > 0)
                    Flexible(
                      child: TextButton(
                        onPressed: () {
                          setState(() {
                            _transactionDisplayLimit += _transactionPageStep;
                          });
                        },
                        style: TextButton.styleFrom(
                          backgroundColor: AppColors.surfaceLight,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 9,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.keyboard_arrow_down_rounded,
                                color: AppColors.deepTeal,
                                size: 20,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Show More ($remainingCount more)',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.deepTeal,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  if (remainingCount > 0 && canCollapse)
                    const SizedBox(width: 8),
                  if (canCollapse)
                    Flexible(
                      child: TextButton(
                        onPressed: () {
                          setState(() {
                            _transactionDisplayLimit = _initialTransactionLimit;
                          });
                        },
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 9,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                        child: const FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.keyboard_arrow_up_rounded,
                                color: Colors.black54,
                                size: 19,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Show Less',
                                style: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.black54,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  IconData _transactionIcon(WalletTransaction transaction) {
    switch (transaction.sourceType) {
      case 'topup_paid':
        return Icons.add_card_rounded;
      case 'order_spend':
        return Icons.local_cafe_outlined;
      case 'refund_return':
        return Icons.replay_rounded;
      case 'expiry':
        return Icons.history_toggle_off_rounded;
      case 'admin_adjustment':
        return Icons.tune_rounded;
      case 'promo_credit':
      case 'voucher_subsidy':
      case 'referral_reward':
        return Icons.card_giftcard_rounded;
      default:
        return transaction.isCredit
            ? Icons.arrow_downward_rounded
            : Icons.arrow_upward_rounded;
    }
  }

  void _showTransactionDetailsDialog(WalletTransaction transaction) {
    final createdLabel =
        DateFormat('EEEE, dd MMM yyyy • h:mm a').format(transaction.createdAt);
    final isCredit = transaction.isCredit;
    final amountColor =
        isCredit ? const Color(0xFF2E7D32) : AppColors.deepTeal;
    final sign = isCredit ? '+' : '-';

    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
        ),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: isCredit
                      ? const Color(0xFFE8F5E9)
                      : AppColors.surfaceLight,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _transactionIcon(transaction),
                  color: amountColor,
                  size: 28,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _transactionTitle(transaction),
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                '$sign ${_formatTokenCount(transaction.amount)}',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: amountColor,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                createdLabel,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 14.5,
                  color: Colors.black54,
                ),
              ),
              const SizedBox(height: 18),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F9FA),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Type',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            color: Colors.black54,
                          ),
                        ),
                        Text(
                          isCredit ? 'Incoming Credit' : 'Outgoing Spend',
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Balance After',
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            color: Colors.black54,
                          ),
                        ),
                        Text(
                          _formatTokenCount(transaction.balanceAfter),
                          style: TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.deepTeal,
                          ),
                        ),
                      ],
                    ),
                    if (transaction.remarks?.trim().isNotEmpty == true) ...[
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Details',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              color: Colors.black54,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              transaction.remarks!.trim(),
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Colors.black87,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
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
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTransactionRow(WalletTransaction transaction) {
    final createdLabel =
        DateFormat('dd MMM yyyy, h:mm a').format(transaction.createdAt);
    final isCredit = transaction.isCredit;
    final amountLabel =
        '${isCredit ? '+' : '-'} ${_formatTokenCount(transaction.amount)}';
    final amountColor =
        isCredit ? const Color(0xFF2E7D32) : AppColors.deepTeal;

    return InkWell(
      onTap: () => _showTransactionDetailsDialog(transaction),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isCredit
                    ? const Color(0xFFE8F5E9)
                    : AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                _transactionIcon(transaction),
                color: amountColor,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _transactionTitle(transaction),
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 17,
                      fontWeight: FontWeight.bold,
                      color: AppColors.deepTeal,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    transaction.remarks?.trim().isNotEmpty == true
                        ? transaction.remarks!
                        : createdLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14.5,
                      color: Colors.black54,
                    ),
                  ),
                  if (transaction.remarks?.trim().isNotEmpty == true)
                    Text(
                      createdLabel,
                      style: const TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 13,
                        color: Colors.black45,
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: isCredit
                        ? const Color(0xFFE8F5E9)
                        : AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    amountLabel,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: amountColor,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Bal: ${transaction.balanceAfter}',
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _transactionTitle(WalletTransaction transaction) {
    switch (transaction.sourceType) {
      case 'topup_paid':
        return 'Top Up';
      case 'order_spend':
        return 'Order Payment';
      case 'refund_return':
        return 'Refund';
      case 'expiry':
        return 'Expired Tokens';
      case 'admin_adjustment':
        return 'Admin Adjustment';
      case 'promo_credit':
        return 'Promo Credit';
      case 'voucher_subsidy':
        return 'Voucher Subsidy';
      case 'referral_reward':
        return 'Referral Reward';
      default:
        return 'Wallet Transaction';
    }
  }

  int _compareTransactionsNewestFirst(
    WalletTransaction a,
    WalletTransaction b,
  ) {
    final idCmp = b.id.compareTo(a.id);
    if (idCmp != 0) return idCmp;

    final timeCmp = b.createdAt.compareTo(a.createdAt);
    if (timeCmp != 0) return timeCmp;

    return 0;
  }
}
