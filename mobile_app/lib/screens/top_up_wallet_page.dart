import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';

import '../utils/app_colors.dart';
import 'loading_order_page.dart';
import '../widgets/app_page_shell.dart';

enum TransactionFilter { all, incoming, outgoing }

enum TopUpPaymentMethod { touchNGo, card, bankTransfer }

class TopUpWalletPage extends StatefulWidget {
  const TopUpWalletPage({super.key});

  @override
  State<TopUpWalletPage> createState() => _TopUpWalletPageState();
}

class _TopUpWalletPageState extends State<TopUpWalletPage>
    with WidgetsBindingObserver {
  final AppSessionService _session = AppSessionService.instance;
  static const bool _topUpGatewayEnabled = true;
  int? _selectedPackageId;
  List<TokenTopUpPackage> _packages = const [];
  TopUpPaymentMethod? _paymentMethod;
  Set<TopUpPaymentMethod> _availablePaymentMethods = const {};
  bool _isPaymentMethodsLoading = true;
  String? _paymentMethodsError;
  OnlineBankOption? _selectedBank;
  bool _isStartingTopUp = false;
  String? _pendingTopUpRef;
  bool _isTransactionsLoading = true;
  String? _transactionsError;
  List<WalletTransaction> _transactions = const [];
  TransactionFilter _selectedFilter = TransactionFilter.all;

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
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadWalletData();
      _loadPaymentMethods();
      _loadPackages();
    });
  }

  Future<void> _loadPackages() async {
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) return;
      final packages = await CustomerDataService.instance
          .getTopUpPackages(accessToken: token);
      if (mounted) setState(() => _packages = packages);
    } catch (_) {
      // The purchase button stays disabled until trusted server packages load.
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.removeListener(_handleSessionChanged);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _pendingTopUpRef != null) {
      _refreshReturnedTopUp();
    }
  }

  Future<void> _refreshReturnedTopUp() async {
    final topupRef = _pendingTopUpRef;
    if (topupRef == null) return;

    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) return;
      final topup = await CustomerDataService.instance.getOnlineTopUp(
        accessToken: token,
        topupRef: topupRef,
      );
      if (!mounted || topup.status != 'paid') return;
      setState(() => _pendingTopUpRef = null);
      await _loadWalletData(forceSessionReload: true);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Payment confirmed. Your C2 Tokens are ready.')),
        );
      }
    } catch (_) {
      // The signed server callback remains the payment authority. The next
      // app resume or wallet refresh will try again if it has not arrived yet.
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
          .getBillplzPaymentMethods(accessToken: token);
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
        if (_paymentMethod != TopUpPaymentMethod.bankTransfer) {
          _selectedBank = null;
        }
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
      case 'touch_n_go':
        return TopUpPaymentMethod.touchNGo;
      case 'card':
        return TopUpPaymentMethod.card;
      case 'bank_transfer':
        return TopUpPaymentMethod.bankTransfer;
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
      case TopUpPaymentMethod.touchNGo:
        return "Touch 'n Go eWallet";
      case TopUpPaymentMethod.card:
        return 'Credit or debit card';
      case TopUpPaymentMethod.bankTransfer:
        return _selectedBank?.label ?? 'Online banking';
      case null:
        return 'Choose a payment method';
    }
  }

  String? get _paymentMethodApiValue {
    switch (_paymentMethod) {
      case TopUpPaymentMethod.touchNGo:
        return 'touch_n_go';
      case TopUpPaymentMethod.card:
        return 'card';
      case TopUpPaymentMethod.bankTransfer:
        return 'bank_transfer';
      case null:
        return null;
    }
  }

  Future<void> _chooseBank() async {
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) {
        throw ApiException('Missing access token.');
      }
      final banks = await CustomerDataService.instance
          .getBillplzBanks(accessToken: token);
      if (!mounted) return;
      final selection = await showModalBottomSheet<OnlineBankOption>(
        context: context,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: [
              const ListTile(title: Text('Choose your bank')),
              ...banks.map((bank) => ListTile(
                    title: Text(bank.label),
                    subtitle: Text(bank.code),
                    onTap: () => Navigator.pop(sheetContext, bank),
                  )),
            ],
          ),
        ),
      );
      if (selection != null && mounted) {
        setState(() => _selectedBank = selection);
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_friendlyMessage(error))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Unable to load online banking options.')));
      }
    }
  }

  Future<void> _startTopUp() async {
    final selectedPackage =
        _packages.where((item) => item.id == _selectedPackageId).firstOrNull;
    if (selectedPackage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Choose a token amount first.')));
      return;
    }
    if (_paymentMethod == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Choose an available payment method.')),
      );
      return;
    }
    if (_paymentMethod == TopUpPaymentMethod.bankTransfer &&
        _selectedBank == null) {
      await _chooseBank();
      if (_selectedBank == null) {
        return;
      }
    }

    setState(() => _isStartingTopUp = true);
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) {
        throw ApiException('Missing access token.');
      }
      final topup = await CustomerDataService.instance.startBillplzTopUp(
        accessToken: token,
        packageId: selectedPackage.id,
        paymentMethod: _paymentMethodApiValue!,
        bankCode: _selectedBank?.code,
      );
      if (topup.checkoutUrl.isEmpty ||
          !await launchUrl(Uri.parse(topup.checkoutUrl),
              mode: LaunchMode.externalApplication)) {
        throw ApiException('Unable to open the payment page.');
      }
      if (mounted) {
        setState(() => _pendingTopUpRef = topup.topupRef);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text(
                  'Complete payment in your browser, then return to C2 Coffee.')),
        );
      }
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_friendlyMessage(error))));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Unable to start payment. Please try again.')));
      }
    } finally {
      if (mounted) {
        setState(() => _isStartingTopUp = false);
      }
    }
  }

  void _showTokenInfoDialog(BuildContext context) {
    final Color brandColor = AppColors.deepTeal;
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
        title: Row(
          children: [
            Icon(Icons.info_outline, color: brandColor),
            const SizedBox(width: 8),
            Text(
              'Token Information',
              style: TextStyle(
                fontFamily: 'Recoleta',
                color: brandColor,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: Text(
          '1 token = RM 1\n\nCurrent balance: ${_session.tokenBalance} tokens\nReserved: ${_session.tokenReserved} tokens\nBalance cap: ${_session.tokenCap} tokens.',
          style: const TextStyle(
            fontFamily: 'Afacad',
            fontSize: 15,
            color: Colors.black87,
            height: 1.3,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'GOT IT',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontWeight: FontWeight.bold,
                color: brandColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final Color brandColor = AppColors.deepTeal;

    return PopScope(
      canPop: true,
      child: AppPageShell(
        title: 'TOP UP WALLET',
        onBack: () => InteractiveFillingLoader.showPop(context),
        backgroundColor: Colors.white,
        trailing: GestureDetector(
          onTap: () => _showTokenInfoDialog(context),
          child: const Icon(
            Icons.info_outline,
            color: Colors.white,
            size: 22,
          ),
        ),
        bodyPadding: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildBalanceCard(),
              const SizedBox(height: 24),
              Text(
                'Select amount',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: brandColor,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: List.generate(_packages.length, (i) {
                  final package = _packages[i];
                  final selected = _selectedPackageId == package.id;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () =>
                          setState(() => _selectedPackageId = package.id),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        margin: EdgeInsets.only(
                          right: i < _packages.length - 1 ? 12 : 0,
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        decoration: BoxDecoration(
                          color: selected ? brandColor : AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: selected ? brandColor : AppColors.border,
                            width: 1.5,
                          ),
                        ),
                        child: Column(
                          children: [
                            Text(
                              'TOKENS',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: selected
                                    ? Colors.white70
                                    : Colors.grey.shade600,
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              '${package.tokenAmount}',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                color: selected ? Colors.white : brandColor,
                                height: 1.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 24),
              _buildTopUpCard(),
              const SizedBox(height: 28),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recent Transactions',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: brandColor,
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
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      padding: const EdgeInsets.all(20),
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
          Positioned(
            right: -30,
            top: -36,
            child: Container(
              width: 130,
              height: 130,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.07),
                shape: BoxShape.circle,
              ),
            ),
          ),
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
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.9,
                        color: Colors.white.withValues(alpha: 0.76),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${_session.tokenBalance} tokens',
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 27,
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
            margin: const EdgeInsets.only(top: 76),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
            ),
            child: Text(
              '${_session.tokenReserved} reserved  •  wallet cap ${_session.tokenCap}',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.white.withValues(alpha: 0.86),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopUpCard() {
    final selectedPackage =
        _packages.where((item) => item.id == _selectedPackageId).firstOrNull;
    final tokenAmount = selectedPackage?.tokenAmount;
    final rmAmount = selectedPackage?.amountRm;
    final canContinue = _topUpGatewayEnabled &&
        !_isStartingTopUp &&
        !_isPaymentMethodsLoading &&
        tokenAmount != null &&
        _paymentMethod != null;

    return Container(
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
                    fontSize: 21,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
              ),
              if (tokenAmount != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    'RM $rmAmount',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
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
                        : tokenAmount == null
                            ? 'Choose a token package, then select how you want to pay.'
                            : 'You will add $tokenAmount tokens for RM $rmAmount using $_paymentMethodLabel. Tokens are added only after payment is confirmed.',
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
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
                fontWeight: FontWeight.bold,
                color: AppColors.deepTeal,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: TopUpPaymentMethod.values
                  .map(
                    (method) => Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(
                          right:
                              method == TopUpPaymentMethod.bankTransfer ? 0 : 8,
                        ),
                        child: _buildPaymentMethodCard(method),
                      ),
                    ),
                  )
                  .toList(),
            ),
            if (_paymentMethod == TopUpPaymentMethod.bankTransfer) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _isStartingTopUp ? null : _chooseBank,
                  icon: const Icon(Icons.account_balance_outlined),
                  label: Text(_selectedBank?.label ?? 'Choose bank'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.deepTeal,
                    side: BorderSide(color: AppColors.deepTeal),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 18),
          ],
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: canContinue ? _startTopUp : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.deepTeal,
                disabledBackgroundColor: AppColors.border,
                padding: const EdgeInsets.symmetric(vertical: 18),
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
                            : 'CONTINUE TO PAYMENT',
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodCard(TopUpPaymentMethod method) {
    final selected = _paymentMethod == method;
    final available = _availablePaymentMethods.contains(method);
    final presentation = switch (method) {
      TopUpPaymentMethod.touchNGo => (
          "Touch 'n Go",
          Icons.account_balance_wallet_outlined
        ),
      TopUpPaymentMethod.card => ('Card', Icons.credit_card_outlined),
      TopUpPaymentMethod.bankTransfer => (
          'Online banking',
          Icons.account_balance_outlined
        ),
    };

    return InkWell(
      onTap: !available || _isStartingTopUp
          ? null
          : () => setState(() {
                _paymentMethod = method;
                if (method != TopUpPaymentMethod.bankTransfer) {
                  _selectedBank = null;
                }
              }),
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 112,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.deepTeal
              : available
                  ? AppColors.surfaceLight
                  : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected
                ? AppColors.deepTeal
                : available
                    ? AppColors.border
                    : Colors.grey.shade300,
            width: 1.2,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              presentation.$2,
              size: 25,
              color: selected
                  ? Colors.white
                  : available
                      ? AppColors.deepTeal
                      : Colors.grey.shade500,
            ),
            const SizedBox(height: 7),
            Text(
              presentation.$1,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 12,
                fontWeight: FontWeight.bold,
                height: 1,
                color: selected
                    ? Colors.white
                    : available
                        ? AppColors.deepTeal
                        : Colors.grey.shade500,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              available ? (selected ? 'Selected' : 'Available') : 'Unavailable',
              style: TextStyle(
                fontFamily: 'Afacad',
                fontSize: 10,
                color: selected
                    ? Colors.white.withValues(alpha: 0.76)
                    : Colors.grey.shade500,
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
              fontSize: 14,
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
          Icon(
            Icons.receipt_long_outlined,
            size: 38,
            color: AppColors.deepTeal,
          ),
          const SizedBox(height: 12),
          Text(
            'Wallet transactions',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
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
                });
              },
              borderRadius: BorderRadius.circular(20),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
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
                    fontSize: 13,
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
          ? 'No incoming (+) transactions found.'
          : _selectedFilter == TransactionFilter.outgoing
              ? 'No outgoing (-) transactions found.'
              : 'No wallet transactions found yet.';
      return _buildTransactionsPlaceholder(message: msg);
    }

    return Container(
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
          for (var i = 0; i < list.length; i++) ...[
            _buildTransactionRow(list[i]),
            if (i < list.length - 1)
              Divider(height: 1, color: AppColors.border, thickness: 1),
          ],
        ],
      ),
    );
  }

  Widget _buildTransactionRow(WalletTransaction transaction) {
    final createdLabel =
        DateFormat('dd MMM yyyy, h:mm a').format(transaction.createdAt);
    final amountLabel =
        '${transaction.isCredit ? '+' : '-'} ${transaction.amount} tokens';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              transaction.isCredit
                  ? Icons.arrow_downward_rounded
                  : Icons.arrow_upward_rounded,
              color: AppColors.deepTeal,
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
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.deepTeal,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  transaction.remarks?.trim().isNotEmpty == true
                      ? transaction.remarks!
                      : createdLabel,
                  style: const TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: Colors.black54,
                  ),
                ),
                if (transaction.remarks?.trim().isNotEmpty == true)
                  Text(
                    createdLabel,
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12,
                      color: Colors.black45,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amountLabel,
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.deepTeal,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Balance ${transaction.balanceAfter}',
                style: const TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 12,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
        ],
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
