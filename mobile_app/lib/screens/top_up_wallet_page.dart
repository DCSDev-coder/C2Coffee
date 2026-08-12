import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/app_session_service.dart';
import '../services/auth_api_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import 'loading_order_page.dart';

class TopUpWalletPage extends StatefulWidget {
  const TopUpWalletPage({super.key});

  @override
  State<TopUpWalletPage> createState() => _TopUpWalletPageState();
}

class _TopUpWalletPageState extends State<TopUpWalletPage> {
  final AppSessionService _session = AppSessionService.instance;
  int? _selectedAmount;
  final List<int> _presetAmounts = [20, 50, 100];
  bool _isTransactionsLoading = true;
  String? _transactionsError;
  List<WalletTransaction> _transactions = const [];

  @override
  void initState() {
    super.initState();
    _session.addListener(_handleSessionChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadWalletData();
    });
  }

  @override
  void dispose() {
    _session.removeListener(_handleSessionChanged);
    super.dispose();
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
      final accessToken = await SecureSessionService.instance.getAccessToken();
      if (accessToken == null || accessToken.isEmpty) {
        throw ApiException(
          'Missing access token.',
          code: 'missing_access_token',
        );
      }

      final transactions = await CustomerDataService.instance.getWalletTransactions(
        accessToken: accessToken,
      );

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

  String _friendlyMessage(ApiException error) {
    switch (error.code) {
      case 'missing_access_token':
      case 'missing_bearer_token':
      case 'invalid_access_token':
      case 'session_not_found':
      case 'session_version_mismatch':
      case 'user_not_active':
        return 'Your session has expired. Please log in again.';
      default:
        return error.message;
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
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SingleChildScrollView(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: EdgeInsets.only(
                  top: MediaQuery.paddingOf(context).top + 14,
                  bottom: 16,
                  left: 20,
                  right: 20,
                ),
                decoration: BoxDecoration(
                  color: AppColors.deepTeal,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(20),
                    bottomRight: Radius.circular(20),
                  ),
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: GestureDetector(
                        onTap: () => InteractiveFillingLoader.showPop(context),
                        child: const Icon(
                          Icons.arrow_back_ios,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                    const Text(
                      'TOP UP WALLET',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 1.0,
                      ),
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: GestureDetector(
                        onTap: () => _showTokenInfoDialog(context),
                        child: const Icon(
                          Icons.info_outline,
                          color: Colors.white,
                          size: 22,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
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
                      children: List.generate(_presetAmounts.length, (i) {
                        final amount = _presetAmounts[i];
                        final selected = _selectedAmount == i;
                        return Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedAmount = i),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              margin: EdgeInsets.only(
                                right: i < _presetAmounts.length - 1 ? 12 : 0,
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 18),
                              decoration: BoxDecoration(
                                color: selected
                                    ? brandColor
                                    : AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: selected
                                      ? brandColor
                                      : AppColors.border,
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
                                    '$amount',
                                    style: TextStyle(
                                      fontFamily: 'Recoleta',
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                      color: selected
                                          ? Colors.white
                                          : brandColor,
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
                    _buildTopUpUnavailableCard(),
                    const SizedBox(height: 24),
                    Text(
                      'Recent Transactions',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: brandColor,
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (_isTransactionsLoading)
                      _buildTransactionsLoading()
                    else if (_transactionsError != null)
                      _buildTransactionsPlaceholder(message: _transactionsError!)
                    else if (_transactions.isEmpty)
                      _buildTransactionsPlaceholder(
                        message: 'No wallet transactions found yet.',
                      )
                    else
                      _buildTransactionsList(),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBalanceCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Image.asset('assets/images/wallet.png', height: 48),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Balance',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 14,
                    color: Colors.black54,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_session.tokenBalance} tokens',
                  style: TextStyle(
                    fontFamily: 'Recoleta',
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: AppColors.gold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${_session.tokenReserved} reserved • cap ${_session.tokenCap}',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 13,
                    color: AppColors.deepTeal.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopUpUnavailableCard() {
    return Container(
      padding: const EdgeInsets.all(20),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Top up payment is not enabled yet',
            style: TextStyle(
              fontFamily: 'Recoleta',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.deepTeal,
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Your wallet balance and transaction history are live. Customer top-up checkout is still not enabled on the backend yet.',
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 15,
              color: Colors.black54,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedAmount == null ? null : () {},
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
                _selectedAmount == null
                    ? 'SELECT AN AMOUNT'
                    : 'TOP UP ${_presetAmounts[_selectedAmount!]} TOKENS',
                style: const TextStyle(
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

  Widget _buildTransactionsList() {
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
          for (var i = 0; i < _transactions.length; i++) ...[
            _buildTransactionRow(_transactions[i]),
            if (i < _transactions.length - 1)
              Divider(height: 1, color: AppColors.border, thickness: 1),
          ],
        ],
      ),
    );
  }

  Widget _buildTransactionRow(WalletTransaction transaction) {
    final createdLabel = DateFormat('dd MMM yyyy, h:mm a').format(transaction.createdAt);
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
      default:
        return 'Wallet Transaction';
    }
  }
}
