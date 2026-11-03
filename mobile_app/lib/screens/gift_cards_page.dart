import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/app_session_service.dart';
import '../services/customer_data_service.dart';
import '../services/secure_session_service.dart';
import '../utils/app_colors.dart';
import '../utils/app_notification.dart';
import '../widgets/app_page_shell.dart';

class GiftCardsPage extends StatefulWidget {
  const GiftCardsPage({super.key});

  @override
  State<GiftCardsPage> createState() => _GiftCardsPageState();
}

class _GiftCardsPageState extends State<GiftCardsPage>
    with WidgetsBindingObserver {
  final AppSessionService _session = AppSessionService.instance;

  bool _loading = true;
  bool _submitting = false;
  String? _error;
  List<GiftCard> _cards = const [];
  String? _pendingPurchaseRef;
  String? _pendingGiftCardCode;
  bool _refreshingPendingPurchase = false;

  // Preset Card Options matching C2 Coffee brand theme (Plum / Teal / Gold / Terracotta)
  List<({int amount, String title, List<Color> gradient, Color shadowColor, Color accentColor})> get _presets {
    final prim = AppColors.primary;
    final gold = AppColors.gold;
    final terracotta = const Color(0xFFC05844);
    final deepEmerald = const Color(0xFF1E433A);

    return [
      (
        amount: 10,
        title: 'C2 Gift Card RM10',
        gradient: [
          terracotta,
          Color.lerp(terracotta, gold, 0.35)!,
        ],
        shadowColor: terracotta.withValues(alpha: 0.25),
        accentColor: gold,
      ),
      (
        amount: 20,
        title: 'C2 Gift Card RM20',
        gradient: [
          prim,
          Color.lerp(prim, Colors.white, 0.18)!,
        ],
        shadowColor: prim.withValues(alpha: 0.28),
        accentColor: AppColors.softGold,
      ),
      (
        amount: 50,
        title: 'C2 Gift Card RM50',
        gradient: [
          deepEmerald,
          Color.lerp(deepEmerald, const Color(0xFF387C6D), 0.7)!,
        ],
        shadowColor: deepEmerald.withValues(alpha: 0.28),
        accentColor: gold,
      ),
      (
        amount: 100,
        title: 'C2 Gift Card RM100',
        gradient: [
          const Color(0xFF94621E),
          const Color(0xFFC78B35),
        ],
        shadowColor: const Color(0xFF94621E).withValues(alpha: 0.28),
        accentColor: Colors.white,
      ),
    ];
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session.addListener(_handleSessionChanged);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _session.removeListener(_handleSessionChanged);
    super.dispose();
  }

  void _handleSessionChanged() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshPendingPurchase();
    }
  }

  Future<void> _refreshPendingPurchase() async {
    final purchaseRef = _pendingPurchaseRef;
    if (purchaseRef == null || _refreshingPendingPurchase) return;
    _refreshingPendingPurchase = true;
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) return;
      final status = await CustomerDataService.instance
          .getGiftCardPurchaseStatus(
              accessToken: token, purchaseRef: purchaseRef);
      if (!mounted) return;
      if (status != 'pending_payment') {
        final code = _pendingGiftCardCode ?? '';
        _pendingPurchaseRef = null;
        _pendingGiftCardCode = null;
        if (status == 'active') {
          AppNotification.showSuccess(
            context,
            'Gift card $code is active and ready to share.',
          );
        } else {
          AppNotification.showError(
            context,
            'Payment finished with status ${status.replaceAll('_', ' ')}.',
          );
        }
      }
      await _load();
    } catch (_) {
      // Keep reference for next resume
    } finally {
      _refreshingPendingPurchase = false;
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) {
        throw Exception('Please sign in again.');
      }
      final cards = await CustomerDataService.instance
          .getGiftCards(accessToken: token, includeHistory: true);
      if (mounted) setState(() => _cards = cards);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Unable to load gift cards right now.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _copyCode(String code) async {
    await Clipboard.setData(ClipboardData(text: code));
    if (!mounted) return;
    AppNotification.showSuccess(context, 'Copied gift card code $code');
  }

  Future<void> _shareGiftCard(GiftCard card) async {
    final valueText = card.currency == 'rm'
        ? 'RM ${card.originalAmount}'
        : '${card.originalAmount} C2 Tokens';
    final note = (card.recipientMessage ?? '').trim();
    final messageLines = <String>[
      'Here is a C2 Coffee Gift Card ($valueText) for you! ☕🎁',
      if (note.isNotEmpty) '\n"$note"',
      '\nGift Card Code: ${card.code}',
      'Open C2 Coffee app → Rewards → Gift Cards to claim and redeem it at checkout.',
    ];
    await SharePlus.instance.share(
      ShareParams(
        text: messageLines.join('\n'),
        subject: 'C2 Coffee Gift Card (${card.code})',
      ),
    );
  }

  Future<void> _claim() async {
    final controller = TextEditingController();
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
            final safeBottom = bottomInset > 0
                ? bottomInset + 12
                : MediaQuery.paddingOf(context).bottom + 18;
            final currentText = controller.text.trim();
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
              ),
              padding: EdgeInsets.fromLTRB(20, 10, 20, safeBottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLight,
                          borderRadius: BorderRadius.circular(13),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Icon(
                          Icons.redeem_rounded,
                          color: AppColors.primary,
                          size: 21,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Claim a Gift Card',
                              style: TextStyle(
                                fontFamily: 'Recoleta',
                                fontSize: 19,
                                fontWeight: FontWeight.bold,
                                color: AppColors.brandText,
                              ),
                            ),
                            const SizedBox(height: 1),
                            Text(
                              'Enter the code received to link it to your account.',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 13.5,
                                color: AppColors.brandText.withValues(alpha: 0.65),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        visualDensity: VisualDensity.compact,
                        icon: Icon(
                          Icons.close_rounded,
                          color: AppColors.brandText.withValues(alpha: 0.5),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: currentText.isNotEmpty
                            ? AppColors.primary
                            : AppColors.border,
                        width: currentText.isNotEmpty ? 1.5 : 1,
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
                    child: Row(
                      children: [
                        Icon(
                          Icons.confirmation_number_outlined,
                          color: AppColors.primary,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: controller,
                            autofocus: true,
                            textCapitalization: TextCapitalization.characters,
                            onChanged: (_) => setSheetState(() {}),
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 16.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.1,
                              color: AppColors.brandText,
                            ),
                            decoration: InputDecoration(
                              hintText: 'C2G-XXXX-XXXX',
                              hintStyle: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15.5,
                                color: AppColors.brandText.withValues(alpha: 0.35),
                              ),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                        TextButton.icon(
                          onPressed: () async {
                            final data = await Clipboard.getData('text/plain');
                            final pasted = data?.text?.trim() ?? '';
                            if (pasted.isNotEmpty) {
                              controller.text = pasted.toUpperCase();
                              setSheetState(() {});
                            }
                          },
                          style: TextButton.styleFrom(
                            backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                            foregroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          icon: const Icon(Icons.content_paste_rounded, size: 14),
                          label: const Text(
                            'Paste',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(context),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.brandText,
                            side: BorderSide(color: AppColors.border),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text(
                            'Cancel',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton(
                          onPressed: currentText.isEmpty
                              ? null
                              : () => Navigator.pop(context, currentText.toUpperCase()),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text(
                            'Claim Gift Card',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (code == null || code.isEmpty) return;
    setState(() => _submitting = true);
    try {
      final token = await SecureSessionService.instance.getValidAccessToken();
      if (token == null || token.isEmpty) throw Exception();
      await CustomerDataService.instance.claimGiftCard(accessToken: token, code: code);
      if (!mounted) return;
      AppNotification.showSuccess(context, 'Gift card claimed! Ready to use at checkout.');
      await _load();
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
          context,
          'Could not claim this card. Check the code and your phone number.',
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Procedure for purchasing a preset or Custom Amount Gift Card
  Future<void> _buyPreset([({int amount, String title, List<Color> gradient, Color shadowColor, Color accentColor})? preset]) async {
    final token = await SecureSessionService.instance.getValidAccessToken();
    if (token == null || token.isEmpty) {
      if (mounted) AppNotification.showError(context, 'Please sign in again.');
      return;
    }

    Set<String> availableMethods = const {};
    try {
      availableMethods = (await CustomerDataService.instance
              .getGiftCardPaymentMethods(accessToken: token))
          .methods;
    } catch (_) {}

    if (!mounted) return;

    final isInitialCustom = preset == null;
    var isCustomMode = isInitialCustom;
    final customAmountController = TextEditingController(
      text: preset != null ? '${preset.amount}' : '30',
    );
    final phoneController = TextEditingController();
    final messageController = TextEditingController();
    var payWith = 'token'; // 'token' or 'rm'
    String? paymentMethod = availableMethods.isEmpty ? null : availableMethods.first;

    const paymentLabels = {
      'fpx': 'FPX Online Banking',
      'duitnow_qr': 'DuitNow QR',
      'card': 'Credit / Debit Card',
      'ewallet': 'E-Wallet',
    };
    const quickCustomAmounts = [15, 30, 75, 150, 200];

    final defaultGradient = [
      AppColors.primary,
      Color.lerp(AppColors.primary, AppColors.gold, 0.35)!,
    ];
    final cardGradient = preset?.gradient ?? defaultGradient;
    final cardShadow = preset?.shadowColor ?? AppColors.primary.withValues(alpha: 0.26);

    final request = await showModalBottomSheet<
        ({
          String currency,
          num amount,
          String phone,
          String message,
          String? method
        })>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
            final isKeyboardOpen = bottomInset > 0;
            final safeBottom = isKeyboardOpen
                ? bottomInset + 10.0
                : MediaQuery.paddingOf(context).bottom + 18.0;

            final parsedCustom = num.tryParse(customAmountController.text.trim()) ?? 0;
            final effectiveAmount = isCustomMode
                ? (payWith == 'token' ? parsedCustom.floor() : parsedCustom)
                : (preset?.amount ?? 30);
            final isValidAmount = effectiveAmount >= 5 && effectiveAmount <= 5000;
            final displayAmountStr = payWith == 'rm'
                ? effectiveAmount.toDouble().toStringAsFixed(
                      effectiveAmount % 1 == 0 ? 0 : 2,
                    )
                : '${effectiveAmount.floor()}';
            final sheetTitle = isCustomMode
                ? 'Custom Gift Card'
                : (preset?.title ?? 'Custom Gift Card');

            final tokenBal = _session.tokenBalance;
            final hasEnoughTokens = tokenBal >= effectiveAmount && effectiveAmount >= 5;

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.sizeOf(context).height * 0.82,
              ),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
              ),
              padding: EdgeInsets.only(bottom: safeBottom),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(height: 10),
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(999),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 14, 4),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                sheetTitle,
                                style: TextStyle(
                                  fontFamily: 'Recoleta',
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.brandText,
                                ),
                              ),
                              if (!isKeyboardOpen) ...[
                                const SizedBox(height: 1),
                                Text(
                                  isCustomMode
                                      ? 'Enter any amount from 5 to 5,000.'
                                      : 'Send to a friend or yourself for easy coffee redemption.',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 13.5,
                                    color: AppColors.brandText.withValues(alpha: 0.65),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (!isCustomMode)
                          TextButton.icon(
                            onPressed: () {
                              setSheetState(() => isCustomMode = true);
                            },
                            style: TextButton.styleFrom(
                              backgroundColor: AppColors.surfaceLight,
                              foregroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(999),
                                side: BorderSide(color: AppColors.border),
                              ),
                            ),
                            icon: const Icon(Icons.tune_rounded, size: 14),
                            label: const Text(
                              'Custom',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        const SizedBox(width: 4),
                        IconButton(
                          onPressed: () => Navigator.pop(context),
                          visualDensity: VisualDensity.compact,
                          icon: Icon(
                            Icons.close_rounded,
                            color: AppColors.brandText.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (!isKeyboardOpen) ...[
                            // Compact Card Preview (auto-collapses while keyboard is open so sheet stays low)
                            Container(
                              width: double.infinity,
                              height: 96,
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: cardGradient,
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(18),
                                boxShadow: [
                                  BoxShadow(
                                    color: cardShadow,
                                    blurRadius: 12,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              padding: const EdgeInsets.all(14),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'C2 COFFEE',
                                        style: TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white.withValues(alpha: 0.95),
                                        ),
                                      ),
                                      Text(
                                        effectiveAmount > 0
                                            ? 'RM $displayAmountStr'
                                            : 'RM —',
                                        style: const TextStyle(
                                          fontFamily: 'Recoleta',
                                          fontSize: 27,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                          height: 1.0,
                                        ),
                                      ),
                                    ],
                                  ),
                                  Column(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          color: Colors.white.withValues(alpha: 0.22),
                                          borderRadius: BorderRadius.circular(999),
                                        ),
                                        child: Text(
                                          isCustomMode ? 'CUSTOM PASS' : 'GIFT CARD',
                                          style: const TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 10,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.8,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                      const Text(
                                        '✦ ✦ ✦',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 15,
                                          letterSpacing: 2,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],

                          // Custom Amount Input Section (shown when Custom Gift Card is selected)
                          if (isCustomMode) ...[
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  payWith == 'rm'
                                      ? 'CUSTOM AMOUNT (RM)'
                                      : 'CUSTOM AMOUNT (TOKENS)',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 0.8,
                                    color: AppColors.brandText.withValues(alpha: 0.6),
                                  ),
                                ),
                                Text(
                                  'Min. 5 – Max. 5,000',
                                  style: TextStyle(
                                    fontFamily: 'Afacad',
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: isValidAmount
                                        ? AppColors.brandText.withValues(alpha: 0.45)
                                        : Colors.redAccent,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Container(
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: !isValidAmount && customAmountController.text.isNotEmpty
                                      ? Colors.redAccent
                                      : AppColors.primary.withValues(alpha: 0.45),
                                  width: 1.3,
                                ),
                              ),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: AppColors.primary.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      payWith == 'rm' ? 'RM' : 'TOKENS',
                                      style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: TextField(
                                      controller: customAmountController,
                                      keyboardType: TextInputType.numberWithOptions(
                                        decimal: payWith == 'rm',
                                      ),
                                      onChanged: (_) => setSheetState(() {}),
                                      style: TextStyle(
                                        fontFamily: 'Recoleta',
                                        fontSize: 19,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.brandText,
                                      ),
                                      decoration: InputDecoration(
                                        hintText: 'Enter amount (e.g. 30)',
                                        hintStyle: TextStyle(
                                          fontFamily: 'Afacad',
                                          fontSize: 15,
                                          fontWeight: FontWeight.w500,
                                          color: AppColors.brandText.withValues(alpha: 0.38),
                                        ),
                                        border: InputBorder.none,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: quickCustomAmounts.map((amt) {
                                  final isSelected = effectiveAmount == amt;
                                  return Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: GestureDetector(
                                      onTap: () {
                                        customAmountController.text = '$amt';
                                        setSheetState(() {});
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 12,
                                          vertical: 6,
                                        ),
                                        decoration: BoxDecoration(
                                          color: isSelected
                                              ? AppColors.primary
                                              : AppColors.surfaceLight,
                                          borderRadius: BorderRadius.circular(999),
                                          border: Border.all(
                                            color: isSelected
                                                ? AppColors.primary
                                                : AppColors.border,
                                          ),
                                        ),
                                        child: Text(
                                          payWith == 'rm' ? 'RM $amt' : '$amt Tokens',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w700,
                                            color: isSelected
                                                ? Colors.white
                                                : AppColors.brandText,
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                }).toList(),
                              ),
                            ),
                            const SizedBox(height: 12),
                          ],

                          // Payment Choice (Token or RM)
                          Text(
                            'PAYMENT METHOD',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: AppColors.brandText.withValues(alpha: 0.6),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setSheetState(() => payWith = 'token'),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 160),
                                    padding: const EdgeInsets.all(11),
                                    decoration: BoxDecoration(
                                      color: payWith == 'token'
                                          ? AppColors.primary.withValues(alpha: 0.08)
                                          : AppColors.surfaceLight,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: payWith == 'token'
                                            ? AppColors.primary
                                            : AppColors.border,
                                        width: payWith == 'token' ? 1.5 : 1,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Image.asset(
                                              'assets/images/coin.png',
                                              width: 20,
                                              height: 20,
                                            ),
                                            Icon(
                                              payWith == 'token'
                                                  ? Icons.check_circle_rounded
                                                  : Icons.radio_button_unchecked_rounded,
                                              size: 16,
                                              color: payWith == 'token'
                                                  ? AppColors.primary
                                                  : Colors.black26,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 5),
                                        Text(
                                          '${effectiveAmount > 0 ? effectiveAmount.floor() : 0} Tokens',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.brandText,
                                          ),
                                        ),
                                        Text(
                                          'Balance: $tokenBal',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 12,
                                            color: hasEnoughTokens
                                                ? AppColors.primary
                                                : Colors.redAccent,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setSheetState(() => payWith = 'rm'),
                                  child: AnimatedContainer(
                                    duration: const Duration(milliseconds: 160),
                                    padding: const EdgeInsets.all(11),
                                    decoration: BoxDecoration(
                                      color: payWith == 'rm'
                                          ? AppColors.primary.withValues(alpha: 0.08)
                                          : AppColors.surfaceLight,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                        color: payWith == 'rm'
                                            ? AppColors.primary
                                            : AppColors.border,
                                        width: payWith == 'rm' ? 1.5 : 1,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Container(
                                              width: 20,
                                              height: 20,
                                              decoration: BoxDecoration(
                                                color: AppColors.primary.withValues(alpha: 0.12),
                                                shape: BoxShape.circle,
                                              ),
                                              alignment: Alignment.center,
                                              child: Text(
                                                'RM',
                                                style: TextStyle(
                                                  fontFamily: 'Recoleta',
                                                  fontSize: 9.5,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.primary,
                                                ),
                                              ),
                                            ),
                                            Icon(
                                              payWith == 'rm'
                                                  ? Icons.check_circle_rounded
                                                  : Icons.radio_button_unchecked_rounded,
                                              size: 16,
                                              color: payWith == 'rm'
                                                  ? AppColors.primary
                                                  : Colors.black26,
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 5),
                                        Text(
                                          'RM ${effectiveAmount > 0 ? effectiveAmount.toDouble().toStringAsFixed(2) : "0.00"}',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.brandText,
                                          ),
                                        ),
                                        Text(
                                          'Online / Card',
                                          style: TextStyle(
                                            fontFamily: 'Afacad',
                                            fontSize: 12,
                                            color: AppColors.brandText.withValues(alpha: 0.6),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),

                          if (payWith == 'rm' && availableMethods.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: availableMethods.map((method) {
                                final isSelected = paymentMethod == method;
                                return GestureDetector(
                                  onTap: () => setSheetState(() => paymentMethod = method),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                                    decoration: BoxDecoration(
                                      color: isSelected ? AppColors.primary : AppColors.surfaceLight,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(
                                        color: isSelected ? AppColors.primary : AppColors.border,
                                      ),
                                    ),
                                    child: Text(
                                      paymentLabels[method] ?? method,
                                      style: TextStyle(
                                        fontFamily: 'Afacad',
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: isSelected ? Colors.white : AppColors.brandText,
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ],

                          const SizedBox(height: 14),
                          Text(
                            'RECIPIENT PHONE NUMBER',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: AppColors.brandText.withValues(alpha: 0.6),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                            child: TextField(
                              controller: phoneController,
                              keyboardType: TextInputType.phone,
                              onChanged: (_) => setSheetState(() {}),
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: AppColors.brandText,
                              ),
                              decoration: InputDecoration(
                                icon: Icon(Icons.phone_iphone_rounded, color: AppColors.primary, size: 18),
                                hintText: 'e.g. 0123456789',
                                hintStyle: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: AppColors.brandText.withValues(alpha: 0.4),
                                ),
                                border: InputBorder.none,
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),

                          Text(
                            'PERSONAL NOTE (OPTIONAL)',
                            style: TextStyle(
                              fontFamily: 'Afacad',
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                              color: AppColors.brandText.withValues(alpha: 0.6),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Container(
                            decoration: BoxDecoration(
                              color: AppColors.surfaceLight,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: AppColors.border),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                            child: TextField(
                              controller: messageController,
                              maxLength: 140,
                              maxLines: 2,
                              onChanged: (_) => setSheetState(() {}),
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                color: AppColors.brandText,
                              ),
                              decoration: InputDecoration(
                                hintText: 'e.g. Coffee on me! ☕',
                                counterText: '',
                                hintStyle: TextStyle(
                                  fontFamily: 'Afacad',
                                  fontSize: 14,
                                  color: AppColors.brandText.withValues(alpha: 0.4),
                                ),
                                border: InputBorder.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => Navigator.pop(context),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.brandText,
                              side: BorderSide(color: AppColors.border),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text(
                              'Cancel',
                              style: TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton(
                            onPressed: !isValidAmount ||
                                    (payWith == 'token' && !hasEnoughTokens) ||
                                    (payWith == 'rm' && paymentMethod == null) ||
                                    phoneController.text.trim().length < 3
                                ? null
                                : () => Navigator.pop(context, (
                                      currency: payWith,
                                      amount: effectiveAmount,
                                      phone: phoneController.text.trim(),
                                      message: messageController.text.trim(),
                                      method: paymentMethod,
                                    )),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.35),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                            child: Text(
                              payWith == 'token'
                                  ? 'Confirm & Send'
                                  : 'Pay RM ${effectiveAmount > 0 ? effectiveAmount.toDouble().toStringAsFixed(2) : "0.00"}',
                              style: const TextStyle(
                                fontFamily: 'Afacad',
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
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
          },
        );
      },
    );

    if (request == null) return;
    setState(() => _submitting = true);
    try {
      final purchase = await CustomerDataService.instance.purchaseGiftCard(
        accessToken: token,
        currency: request.currency,
        amount: request.amount,
        recipientPhone: request.phone,
        recipientMessage: request.message.isEmpty ? null : request.message,
        paymentMethod: request.currency == 'rm' ? request.method : null,
        idempotencyKey: _newGiftCardIdempotencyKey(),
      );

      if (purchase.checkoutUrl != null && purchase.checkoutUrl!.isNotEmpty) {
        _pendingPurchaseRef = purchase.purchaseRef;
        _pendingGiftCardCode = purchase.code;
        await launchUrl(Uri.parse(purchase.checkoutUrl!), mode: LaunchMode.externalApplication);
      }

      if (!mounted) return;
      if (purchase.status == 'active') {
        AppNotification.showSuccess(
          context,
          'Gift card created! Code: ${purchase.code}',
        );
      } else {
        AppNotification.showSuccess(
          context,
          'Complete payment in browser to activate gift card ${purchase.code}.',
        );
      }
      await _load();
    } catch (_) {
      if (mounted) {
        AppNotification.showError(
          context,
          'Unable to complete purchase. Please check your balance or payment details.',
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _newGiftCardIdempotencyKey() {
    final randomPart = Random.secure().nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
    return '${DateTime.now().microsecondsSinceEpoch.toRadixString(16)}_$randomPart';
  }

  @override
  Widget build(BuildContext context) {
    final tokenBalance = _session.tokenBalance;

    return AppPageShell(
      title: 'Store',
      onBack: () => Navigator.of(context).pop(),
      scrollable: false,
      child: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(14, 10, 14, 28),
          children: [
            // Top Balance Section
            Center(
              child: Column(
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Image.asset(
                        'assets/images/coin.png',
                        width: 32,
                        height: 32,
                        fit: BoxFit.contain,
                      ),
                      const SizedBox(width: 7),
                      Text(
                        '$tokenBalance',
                        style: const TextStyle(
                          fontFamily: 'Recoleta',
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          color: Colors.black87,
                          height: 1.0,
                        ),
                      ),
                      const Text(
                        '.00',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: Colors.black45,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  const Text(
                    'My Points / C2 Tokens',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: Colors.black45,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Claim Code Action Pill
            Center(
              child: InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: _submitting ? null : _claim,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.redeem_rounded, size: 15, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Text(
                        'Have a gift card code? Claim here',
                        style: TextStyle(
                          fontFamily: 'Afacad',
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // 2x2 Preset Cards Grid (Column + Row sizes naturally to content height with zero overflow or extra gap)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildStoreCardItem(_presets[0])),
                    const SizedBox(width: 12),
                    Expanded(child: _buildStoreCardItem(_presets[1])),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _buildStoreCardItem(_presets[2])),
                    const SizedBox(width: 12),
                    Expanded(child: _buildStoreCardItem(_presets[3])),
                  ],
                ),
                const SizedBox(height: 12),
                _buildCustomAmountCard(),
              ],
            ),

            const SizedBox(height: 14),

            // Transaction Record Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Transaction record',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: Colors.black54,
                  ),
                ),
                if (_cards.isNotEmpty)
                  Text(
                    '${_cards.length} card${_cards.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.black38,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),

            // Transaction Record List (Border-free clean rows with soft dividers)
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Center(
                  child: Text(
                    _error!,
                    style: const TextStyle(fontFamily: 'Afacad', color: Colors.black54),
                  ),
                ),
              )
            else if (_cards.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                child: Center(
                  child: Text(
                    'No gift card transactions yet.\nTap any card above to purchase or send.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 14,
                      color: Colors.black45,
                      height: 1.35,
                    ),
                  ),
                ),
              )
            else
              ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _cards.length,
                separatorBuilder: (context, index) => Divider(
                  height: 1,
                  thickness: 1,
                  color: Colors.black.withValues(alpha: 0.05),
                ),
                itemBuilder: (context, index) => _buildTransactionRow(_cards[index]),
              ),
          ],
        ),
      ),
    );
  }

  // Full-width Custom Amount Gift Card option right below the 2x2 presets
  Widget _buildCustomAmountCard() {
    final prim = AppColors.primary;
    final gold = AppColors.gold;
    return GestureDetector(
      onTap: _submitting ? null : () => _buyPreset(),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
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
            // Mini Custom Gift Pass graphic
            Container(
              width: 64,
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    prim,
                    Color.lerp(prim, gold, 0.35)!,
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: prim.withValues(alpha: 0.22),
                    blurRadius: 6,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'C2',
                    style: TextStyle(
                      fontFamily: 'Recoleta',
                      fontSize: 12,
                      fontWeight: FontWeight.w900,
                      color: Colors.white.withValues(alpha: 0.95),
                      height: 1.0,
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Icon(
                        Icons.tune_rounded,
                        size: 11,
                        color: Colors.white,
                      ),
                      Text(
                        '✦ ✦',
                        style: TextStyle(
                          fontSize: 8.5,
                          color: AppColors.softGold,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Custom Gift Card',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.brandText,
                    ),
                  ),
                  const SizedBox(height: 1),
                  Row(
                    children: [
                      Image.asset(
                        'assets/images/coin.png',
                        width: 13,
                        height: 13,
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          'Enter any amount (5 – 5,000)',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'Afacad',
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Colors.black54,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: prim.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Customise',
                    style: TextStyle(
                      fontFamily: 'Afacad',
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: prim,
                    ),
                  ),
                  const SizedBox(width: 3),
                  Icon(
                    Icons.arrow_forward_ios_rounded,
                    size: 11,
                    color: prim,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // 2x2 Store Card Item widget
  Widget _buildStoreCardItem(({int amount, String title, List<Color> gradient, Color shadowColor, Color accentColor}) preset) {
    return GestureDetector(
      onTap: _submitting ? null : () => _buyPreset(preset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Gradient Pass Card
          AspectRatio(
            aspectRatio: 1.48,
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: preset.gradient,
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: preset.shadowColor,
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Stack(
                children: [
                  // C2 Text / Logo
                  Positioned(
                    top: 0,
                    left: 0,
                    child: Text(
                      'C2',
                      style: TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Colors.white.withValues(alpha: 0.95),
                      ),
                    ),
                  ),
                  // Amount
                  Positioned(
                    bottom: 0,
                    left: 0,
                    child: Text(
                      'RM ${preset.amount}',
                      style: const TextStyle(
                        fontFamily: 'Recoleta',
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        height: 1.1,
                      ),
                    ),
                  ),
                  // Stars
                  Positioned(
                    bottom: 2,
                    right: 0,
                    child: Text(
                      '✦ ✦ ✦',
                      style: TextStyle(
                        color: preset.accentColor.withValues(alpha: 0.9),
                        fontSize: 12,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          // Title
          Text(
            preset.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontFamily: 'Afacad',
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.brandText,
            ),
          ),
          const SizedBox(height: 2),
          // Price in Tokens / RM
          Row(
            children: [
              Image.asset(
                'assets/images/coin.png',
                width: 14,
                height: 14,
              ),
              const SizedBox(width: 4),
              Text(
                '${preset.amount}  /  RM ${preset.amount}',
                style: TextStyle(
                  fontFamily: 'Afacad',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Transaction Record Row (Clean row without enclosing card box, utilizing full width)
  Widget _buildTransactionRow(GiftCard card) {
    final isSent = card.ownership == 'purchased';
    final dateStr = DateFormat('MMMM d, yyyy').format(card.createdAt);
    final valueText = card.currency == 'rm'
        ? 'RM ${double.tryParse(card.remainingAmount)?.toStringAsFixed(2) ?? card.remainingAmount}'
        : '${card.remainingAmount} Tokens';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        children: [
          // Icon Box
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isSent
                  ? const Color(0xFFC05844).withValues(alpha: 0.12)
                  : AppColors.primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isSent ? Icons.card_giftcard_rounded : Icons.redeem_rounded,
              color: isSent ? const Color(0xFFC05844) : AppColors.primary,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          // Title & Date
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isSent
                      ? 'Gift to ${card.recipientPhone ?? 'Friend'}'
                      : 'Received Gift Card',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.brandText,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$dateStr · ${card.code}',
                  style: TextStyle(
                    fontFamily: 'Afacad',
                    fontSize: 12.5,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          // Value & Action (Copy / Share)
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                valueText,
                style: TextStyle(
                  fontFamily: 'Recoleta',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: isSent ? const Color(0xFFC05844) : AppColors.primary,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap: () => _copyCode(card.code),
                    child: Text(
                      'Copy',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  const Text(' · ', style: TextStyle(color: Colors.black26)),
                  GestureDetector(
                    onTap: () => _shareGiftCard(card),
                    child: Text(
                      'Share',
                      style: TextStyle(
                        fontFamily: 'Afacad',
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
