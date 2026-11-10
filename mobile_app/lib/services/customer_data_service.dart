import 'dart:convert';
import 'dart:math' as math;

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
import 'cart_service.dart';
import 'secure_session_service.dart';

class WalletTransaction {
  final int id;
  final String direction;
  final String sourceType;
  final int sourceId;
  final int amount;
  final int balanceAfter;
  final String? remarks;
  final DateTime createdAt;

  const WalletTransaction({
    required this.id,
    required this.direction,
    required this.sourceType,
    required this.sourceId,
    required this.amount,
    required this.balanceAfter,
    required this.remarks,
    required this.createdAt,
  });

  bool get isCredit => direction == 'credit';

  factory WalletTransaction.fromApi(Map<String, dynamic> json) {
    return WalletTransaction(
      id: (json['id'] as num).toInt(),
      direction: json['direction'] as String? ?? 'debit',
      sourceType: json['source_type'] as String? ?? '',
      sourceId: (json['source_id'] as num?)?.toInt() ?? 0,
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      balanceAfter: (json['balance_after'] as num?)?.toInt() ?? 0,
      remarks: json['remarks'] as String?,
      createdAt: _parseApiDate(json['created_at'] as String),
    );
  }
}

class EmployeeSubsidy {
  final bool eligible;
  final bool enabled;
  final String role;
  final String allowanceMode;
  final int? remaining;
  final int? granted;
  final int used;
  final String? periodEnd;
  const EmployeeSubsidy(
      {required this.eligible,
      required this.enabled,
      required this.role,
      required this.allowanceMode,
      required this.remaining,
      required this.granted,
      required this.used,
      this.periodEnd});
  factory EmployeeSubsidy.fromApi(Map<String, dynamic> json) => EmployeeSubsidy(
        eligible: json['eligible'] == true,
        enabled: json['enabled'] != false,
        role: json['role'] as String? ?? 'none',
        allowanceMode: json['allowance_mode'] as String? ?? 'none',
        remaining: (json['remaining'] as num?)?.toInt(),
        granted: (json['granted'] as num?)?.toInt(),
        used: (json['used'] as num?)?.toInt() ?? 0,
        periodEnd: json['period_end'] as String?,
      );
}

class OnlineTopUpSession {
  final String topupRef;
  final String checkoutUrl;
  final String status;
  final DateTime? expiresAt;

  const OnlineTopUpSession({
    required this.topupRef,
    required this.checkoutUrl,
    required this.status,
    required this.expiresAt,
  });

  factory OnlineTopUpSession.fromApi(Map<String, dynamic> json) {
    return OnlineTopUpSession(
      topupRef: json['topup_ref'] as String? ?? '',
      checkoutUrl: json['checkout_url'] as String? ?? '',
      status: json['status'] as String? ?? 'pending_payment',
      expiresAt: _parseNullableDate(json['expires_at'] as String?),
    );
  }
}

class TokenTopUpPackage {
  final int id;
  final String name;
  final int tokenAmount;
  final String amountRm;

  const TokenTopUpPackage(
      {required this.id,
      required this.name,
      required this.tokenAmount,
      required this.amountRm});

  factory TokenTopUpPackage.fromApi(Map<String, dynamic> json) =>
      TokenTopUpPackage(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? 'C2 Tokens',
        tokenAmount: (json['token_amount'] as num?)?.toInt() ?? 0,
        amountRm: json['amount_rm'] as String? ?? '0.00',
      );
}

class OnlineTopUpPaymentMethods {
  final Set<String> methods;

  const OnlineTopUpPaymentMethods({required this.methods});

  factory OnlineTopUpPaymentMethods.fromApi(Map<String, dynamic> json) {
    return OnlineTopUpPaymentMethods(
      methods: (json['methods'] as List? ?? const [])
          .whereType<String>()
          .map((method) => method.trim())
          .where((method) => method.isNotEmpty)
          .toSet(),
    );
  }
}

class GiftCard {
  final int id;
  final String code;
  final String currency;
  final String originalAmount;
  final String remainingAmount;
  final String status;
  final String ownership;
  final bool isRedeemable;
  final String? recipientPhone;
  final String? recipientMessage;
  final String? purchaseRef;
  final DateTime createdAt;

  const GiftCard({
    required this.id,
    required this.code,
    required this.currency,
    required this.originalAmount,
    required this.remainingAmount,
    required this.status,
    required this.ownership,
    this.isRedeemable = true,
    required this.recipientPhone,
    required this.recipientMessage,
    required this.purchaseRef,
    required this.createdAt,
  });

  factory GiftCard.fromApi(Map<String, dynamic> json) => GiftCard(
        id: (json['id'] as num?)?.toInt() ?? 0,
        code: json['code'] as String? ?? '',
        currency: json['currency'] as String? ?? 'token',
        originalAmount: json['original_amount']?.toString() ?? '0',
        remainingAmount: json['remaining_amount']?.toString() ?? '0',
        status: json['status'] as String? ?? 'active',
        ownership: json['ownership'] as String? ?? 'received',
        isRedeemable: json['is_redeemable'] as bool? ??
            (json['ownership'] as String? ?? 'received') == 'received',
        recipientPhone: json['recipient_phone'] as String?,
        recipientMessage: json['recipient_message'] as String?,
        purchaseRef: json['purchase_ref'] as String?,
        createdAt: _parseApiDate(json['created_at'] as String),
      );

  bool get isUsable =>
      isRedeemable &&
      status == 'active' &&
      (double.tryParse(remainingAmount) ?? 0) > 0;
  String get amountLabel => currency == 'rm'
      ? 'RM ${double.tryParse(remainingAmount)?.toStringAsFixed(2) ?? remainingAmount}'
      : '${double.tryParse(remainingAmount)?.toStringAsFixed(0) ?? remainingAmount} C2 Tokens';
}

class GiftCardPurchase {
  final String code;
  final String purchaseRef;
  final String status;
  final String? checkoutUrl;

  const GiftCardPurchase(
      {required this.code,
      required this.purchaseRef,
      required this.status,
      this.checkoutUrl});

  factory GiftCardPurchase.fromApi(Map<String, dynamic> json) =>
      GiftCardPurchase(
        code: json['code'] as String? ?? '',
        purchaseRef: json['purchase_ref'] as String? ?? '',
        status: json['status'] as String? ?? 'pending_payment',
        checkoutUrl: json['checkout_url'] as String?,
      );
}

class RewardVoucherTemplate {
  final String code;
  final String name;
  final String? imageUrl;
  final String typeLabel;
  final String benefitType;
  final String audience;
  final String voucherType;
  final String discountMode;
  final String discountValue;
  final int? tokenValue;
  final List<String> paymentModes;
  final String? minSpendRm;
  final bool requiresDrinkInCart;
  final String description;
  final String howToUse;
  final Map<String, dynamic> eligibleScope;
  final Map<String, dynamic> excludeScope;
  final Map<String, dynamic> promotionRule;

  const RewardVoucherTemplate({
    required this.code,
    required this.name,
    required this.imageUrl,
    required this.typeLabel,
    required this.benefitType,
    required this.audience,
    required this.voucherType,
    required this.discountMode,
    required this.discountValue,
    required this.tokenValue,
    required this.paymentModes,
    required this.minSpendRm,
    required this.requiresDrinkInCart,
    this.description = '',
    required this.howToUse,
    required this.eligibleScope,
    required this.excludeScope,
    required this.promotionRule,
  });

  factory RewardVoucherTemplate.fromApi(Map<String, dynamic> json) {
    final scope = _parseScopeMap(json['eligible_scope_json']);
    final rawHowToUse = json['usage_instructions'] ??
        json['usageInstructions'] ??
        scope['usage_instructions'];
    return RewardVoucherTemplate(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      imageUrl: json['image_url'] as String?,
      typeLabel: scope['type_label'] as String? ?? '',
      benefitType: scope['benefit_type'] as String? ?? '',
      audience: scope['audience'] as String? ?? 'all_customers',
      voucherType: json['voucher_type'] as String? ?? '',
      discountMode: json['discount_mode'] as String? ?? '',
      discountValue: json['discount_value'] as String? ?? '0.00',
      tokenValue: (json['token_value'] as num?)?.toInt(),
      paymentModes:
          _stringListFromScope(scope, ['payment_modes', 'payment_mode']),
      minSpendRm: json['min_spend_rm'] as String?,
      requiresDrinkInCart: json['requires_drink_in_cart'] as bool? ?? false,
      description: (json['description'] as String? ??
              scope['description'] as String? ??
              '')
          .trim(),
      howToUse: rawHowToUse is String ? rawHowToUse.trim() : '',
      eligibleScope: scope,
      excludeScope: _parseScopeMap(json['exclude_scope_json']),
      promotionRule: _promotionRuleFromScope(scope),
    );
  }

  String get displayLabel => name.trim().isNotEmpty ? name : typeLabel;

  int get rewardQuantity {
    final value = (promotionRule['reward_quantity'] as num?)?.toInt() ?? 1;
    return value.clamp(1, 20).toInt();
  }

  String get benefitLabel {
    final normalizedBenefit = benefitType.trim();
    if (normalizedBenefit == 'Percentage Off' ||
        normalizedBenefit == 'Cash Voucher' ||
        normalizedBenefit == 'Token Discount') {
      return 'Discount';
    }
    if (normalizedBenefit.isNotEmpty) {
      return normalizedBenefit;
    }

    switch (discountMode) {
      case 'fixed_token':
        return 'Token Discount';
      case 'fixed_rm':
        return 'Cash Voucher';
      case 'percent_rm':
        return 'Percentage Off';
      case 'free_drink':
        return 'Free Drink';
      case 'free_option':
        return 'Free option / add-on';
      default:
        return 'Voucher';
    }
  }

  String get benefitSummary {
    final label = benefitLabel;
    if (label != 'Discount') return label;

    final value = double.tryParse(discountValue);
    if (value == null) return label;
    final formatted = value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(2);
    switch (discountMode) {
      case 'percent_rm':
        return '$label · $formatted%';
      case 'fixed_rm':
        return '$label · RM$formatted';
      case 'fixed_token':
        return '$label · $formatted tokens';
      default:
        return label;
    }
  }

  String get audienceLabel {
    switch (audience) {
      case 'employee_only':
        return 'Employee only';
      case 'manual_issue_only':
        return 'Manual issue only';
      default:
        return 'All customers';
    }
  }

  String get eligibilityLabel {
    final qualifyingLabel =
        _scopeLabelFromMap(_promotionScope(eligibleScope, 'qualifying_scope'));
    final rewardLabel =
        _scopeLabelFromMap(_promotionScope(eligibleScope, 'reward_scope'));
    final promotionKind =
        (promotionRule['kind'] as String? ?? 'standard').trim();
    final qualifyingQty =
        (promotionRule['qualifying_quantity'] as num?)?.toInt() ?? 1;
    final rewardQty = (promotionRule['reward_quantity'] as num?)?.toInt() ?? 1;

    if (promotionKind == 'bundle') {
      final buyLabel =
          qualifyingLabel.isNotEmpty ? qualifyingLabel : 'Selected items';
      final freeLabel = rewardLabel.isNotEmpty ? rewardLabel : buyLabel;
      return 'Buy $qualifyingQty from $buyLabel, get $rewardQty from $freeLabel';
    }

    final items = _stringListFromScope(eligibleScope, ['items', 'item_codes']);
    if (items.isNotEmpty) {
      final labels = items.map(_formatScopeValue).toList();
      if (labels.length > 3) {
        return '${labels.take(3).join(', ')} +${labels.length - 3} more';
      }
      return labels.join(', ');
    }

    final categories =
        _stringListFromScope(eligibleScope, ['category_codes', 'categories']);
    if (categories.isNotEmpty) {
      return categories.map(_formatScopeValue).join(', ');
    }

    final stores = _stringListFromScope(eligibleScope, ['store_codes']);
    if (stores.isNotEmpty) {
      return stores.map(_formatScopeValue).join(', ');
    }

    return 'All items';
  }

  String get eligibilitySummary {
    final categories = _stringListFromScope(
      eligibleScope,
      ['category_codes', 'categories'],
    ).map(_formatScopeValue).where((value) => value.isNotEmpty).toList();
    final items = _stringListFromScope(
      eligibleScope,
      ['items', 'item_codes'],
    )
        .where((value) => value.trim().isNotEmpty && value != 'All Items')
        .map(_formatScopeValue)
        .toList();

    String formatItems() {
      if (items.length <= 3) return items.join(', ');
      return items.take(3).join(', ');
    }

    if (categories.isEmpty && items.isEmpty) return 'All categories';
    if (categories.isEmpty) return 'Selected: ${formatItems()}';
    if (items.isEmpty) return categories.join(', ');
    return '${categories.join(', ')} · Selected: ${formatItems()}';
  }

  String get eligibilityDetails {
    final categories = _stringListFromScope(
      eligibleScope,
      ['category_codes', 'categories'],
    ).map(_formatScopeValue).where((value) => value.isNotEmpty).toList();
    final items = _stringListFromScope(
      eligibleScope,
      ['items', 'item_codes'],
    )
        .where((value) => value.trim().isNotEmpty && value != 'All Items')
        .map(_formatScopeValue)
        .toList();
    if (categories.isEmpty && items.isEmpty) return 'All categories';
    if (categories.isEmpty) return 'Selected: ${items.join(', ')}';
    if (items.isEmpty) return categories.join(', ');
    return '${categories.join(', ')} · Selected: ${items.join(', ')}';
  }

  bool get hasExpandedEligibility => eligibilityDetails != eligibilitySummary;

  int get eligibilityMoreCount {
    final items = _stringListFromScope(
      eligibleScope,
      ['items', 'item_codes'],
    ).where((value) => value.trim().isNotEmpty && value != 'All Items').length;
    return items > 3 ? items - 3 : 0;
  }

  String get usageInstructions {
    final custom = howToUse.trim();
    if (custom.isNotEmpty) return custom;
    return 'This voucher is automatically available in Checkout when eligible.';
  }

  String get checkoutAvailabilityLabel {
    if (!isTokenCheckoutCompatible) {
      return 'Not available for checkout';
    }
    if (!isAvailableNow) {
      return 'Not active right now';
    }
    return 'Ready to use';
  }

  List<String> get productKindCodes => _stringListFromScope(
      eligibleScope, ['product_kind_codes', 'product_kinds']);

  List<String> get subcategoryCodes =>
      _stringListFromScope(eligibleScope, ['subcategory_codes']);

  List<String> get itemCodes =>
      _stringListFromScope(eligibleScope, ['item_codes', 'items']);

  bool get isTokenCheckoutCompatible {
    final allowsToken = paymentModes.isEmpty ||
        paymentModes.contains('both') ||
        paymentModes.contains('token');
    if (!allowsToken) return false;
    switch (discountMode) {
      case 'fixed_rm':
      case 'percent_rm':
      case 'fixed_token':
      case 'free_drink':
      case 'free_option':
        return true;
      default:
        return false;
    }
  }

  bool get isDirectCheckoutCompatible {
    final allowsDirect = paymentModes.isEmpty ||
        paymentModes.contains('both') ||
        paymentModes.contains('direct');
    return allowsDirect && discountMode != 'fixed_token';
  }

  bool get isAvailableNow {
    final schedule = eligibleScope['schedule'] is Map<String, dynamic>
        ? eligibleScope['schedule'] as Map<String, dynamic>
        : eligibleScope['schedule'] is Map
            ? Map<String, dynamic>.from(eligibleScope['schedule'] as Map)
            : <String, dynamic>{};
    final mode = (schedule['mode'] as String? ?? 'always').trim();
    if (mode == 'always') {
      return true;
    }

    final now = DateTime.now().toUtc().add(const Duration(hours: 8));
    final currentTime =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final startTime = (schedule['startTime'] as String? ?? '').trim();
    final endTime = (schedule['endTime'] as String? ?? '').trim();

    if (mode == 'birthday') {
      return true;
    }

    if (mode == 'weekly') {
      const weekdayOrder = <String>[
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ];
      final activeDays = (schedule['activeDays'] as List? ?? const [])
          .map((day) => day?.toString().trim() ?? '')
          .where((day) => day.isNotEmpty)
          .toList();
      activeDays.sort(
          (a, b) => weekdayOrder.indexOf(a).compareTo(weekdayOrder.indexOf(b)));
      if (activeDays.isNotEmpty &&
          !activeDays.contains(_weekdayName(now.weekday))) {
        return false;
      }
    }

    if (mode == 'annual') {
      final annualDate = (schedule['annualDate'] as String? ?? '').trim();
      final currentDate =
          '${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      if (annualDate.isNotEmpty && annualDate != currentDate) {
        return false;
      }
    }

    if (mode == 'monthly') {
      final monthlyDay = (schedule['monthlyDay'] as num?)?.toInt() ?? 0;
      if (monthlyDay > 0 && monthlyDay != now.day) {
        return false;
      }
    }

    if (startTime.isNotEmpty && currentTime.compareTo(startTime) < 0) {
      return false;
    }
    if (endTime.isNotEmpty && currentTime.compareTo(endTime) > 0) {
      return false;
    }

    return true;
  }

  bool get isUpcoming {
    final schedule = eligibleScope['schedule'] is Map<String, dynamic>
        ? eligibleScope['schedule'] as Map<String, dynamic>
        : eligibleScope['schedule'] is Map
            ? Map<String, dynamic>.from(eligibleScope['schedule'] as Map)
            : <String, dynamic>{};
    final mode = (schedule['mode'] as String? ?? 'always').trim();
    return mode != 'always' && mode != 'birthday' && !isAvailableNow;
  }

  bool matchesCartSnapshot(CartSnapshot snapshot) {
    final promotionKind =
        (promotionRule['kind'] as String? ?? 'standard').trim();
    final qualifyingQty =
        (promotionRule['qualifying_quantity'] as num?)?.toInt() ?? 1;
    final rewardQty = (promotionRule['reward_quantity'] as num?)?.toInt() ?? 1;
    final qualifyingScope = _promotionScope(eligibleScope, 'qualifying_scope');
    final rewardScope = _promotionScope(eligibleScope, 'reward_scope');

    final requiredSpend = double.tryParse(minSpendRm ?? '');
    if (requiredSpend != null &&
        requiredSpend > 0 &&
        snapshot.subtotalRm < requiredSpend) {
      return false;
    }

    final qualifyingMatchCount = _countMatchedUnits(snapshot, qualifyingScope);
    if (qualifyingMatchCount < qualifyingQty) {
      return false;
    }

    if (promotionKind == 'bundle') {
      return _countMatchedUnits(snapshot, rewardScope) >= rewardQty;
    }

    if (discountMode == 'free_option') {
      return _countMatchedOptionUnits(snapshot, rewardScope) >= rewardQty;
    }

    return qualifyingMatchCount > 0;
  }

  int freeItemTokenDiscount(CartSnapshot snapshot) {
    final promotionKind =
        (promotionRule['kind'] as String? ?? 'standard').trim();
    final qualifyingScope = _parseScopeMap(promotionRule['qualifying_scope']);
    final configuredRewardScope = _parseScopeMap(promotionRule['reward_scope']);
    final rewardScope =
        promotionKind == 'bundle' && configuredRewardScope.isNotEmpty
            ? configuredRewardScope
            : qualifyingScope.isNotEmpty
                ? qualifyingScope
                : eligibleScope;
    final unitPrices = <int>[];

    for (final item in snapshot.items) {
      if (!_itemMatchesScope(item, rewardScope)) continue;
      for (var index = 0; index < item.quantity; index += 1) {
        unitPrices.add(item.unitTotalTokens);
      }
    }

    unitPrices.sort((left, right) => right.compareTo(left));
    return unitPrices
        .take(rewardQuantity)
        .fold<int>(0, (sum, price) => sum + price);
  }

  int freeOptionTokenDiscount(CartSnapshot snapshot) {
    final promotionKind =
        (promotionRule['kind'] as String? ?? 'standard').trim();
    final configuredRewardScope = _parseScopeMap(promotionRule['reward_scope']);
    final rewardScope =
        promotionKind == 'bundle' && configuredRewardScope.isNotEmpty
            ? configuredRewardScope
            : _parseScopeMap(promotionRule['qualifying_scope']);
    final prices = <int>[];
    for (final item in snapshot.items) {
      if (!_itemMatchesScope(item, rewardScope)) continue;
      for (final modifier in item.modifiers) {
        if (!_modifierMatchesOptionScope(modifier, rewardScope)) continue;
        prices.add(math.max(0, modifier.tokenPriceDelta));
      }
    }
    prices.sort((left, right) => right.compareTo(left));
    return prices
        .take(rewardQuantity)
        .fold<int>(0, (sum, price) => sum + price);
  }

  double freeOptionRmDiscount(CartSnapshot snapshot) {
    final rewardScope = _parseScopeMap(promotionRule['reward_scope']);
    final prices = <double>[];
    for (final item in snapshot.items) {
      if (!_itemMatchesScope(item, rewardScope)) continue;
      for (final modifier in item.modifiers) {
        if (_modifierMatchesOptionScope(modifier, rewardScope)) {
          prices.add(math.max(0, modifier.priceDeltaRm));
        }
      }
    }
    prices.sort((left, right) => right.compareTo(left));
    return prices
        .take(rewardQuantity)
        .fold<double>(0, (sum, price) => sum + price);
  }

  String get availabilityLabel {
    final schedule = eligibleScope['schedule'] is Map<String, dynamic>
        ? eligibleScope['schedule'] as Map<String, dynamic>
        : eligibleScope['schedule'] is Map
            ? Map<String, dynamic>.from(eligibleScope['schedule'] as Map)
            : <String, dynamic>{};
    final mode = (schedule['mode'] as String? ?? 'always').trim();
    final startTime =
        _formatTimeLabel((schedule['startTime'] as String? ?? '').trim());
    final endTime =
        _formatTimeLabel((schedule['endTime'] as String? ?? '').trim());
    final timeLabel = _joinTimeRange(startTime, endTime);

    if (mode == 'daily') {
      return timeLabel == null ? 'Every day' : 'Every day, $timeLabel';
    }

    if (mode == 'weekly') {
      const weekdayOrder = <String>[
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ];
      final activeDays = (schedule['activeDays'] as List? ?? const [])
          .map((day) => day?.toString().trim() ?? '')
          .where((day) => day.isNotEmpty)
          .toList();
      activeDays.sort(
          (a, b) => weekdayOrder.indexOf(a).compareTo(weekdayOrder.indexOf(b)));
      final dayLabel =
          activeDays.isEmpty ? 'Selected days' : activeDays.join(', ');
      return timeLabel == null
          ? 'Every $dayLabel'
          : 'Every $dayLabel, $timeLabel';
    }

    if (mode == 'annual') {
      final annualDate = _formatAnnualDateLabel(
              (schedule['annualDate'] as String? ?? '').trim()) ??
          'Selected date';
      return timeLabel == null
          ? 'Every $annualDate'
          : 'Every $annualDate, $timeLabel';
    }

    if (mode == 'monthly') {
      final monthlyDay = (schedule['monthlyDay'] as num?)?.toInt() ?? 0;
      final label = monthlyDay > 0 ? 'day $monthlyDay' : 'the selected day';
      return timeLabel == null
          ? 'Every month on $label'
          : 'Every month on $label, $timeLabel';
    }

    if (mode == 'birthday') {
      return timeLabel == null
          ? 'During your birthday month'
          : 'During your birthday month, $timeLabel';
    }

    return timeLabel == null ? 'Always available' : 'Every day, $timeLabel';
  }

  static Map<String, dynamic> _parseScopeMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    if (value is String && value.isNotEmpty) {
      try {
        final decoded = jsonDecode(value);
        if (decoded is Map<String, dynamic>) return decoded;
        if (decoded is Map) return Map<String, dynamic>.from(decoded);
      } catch (_) {}
    }
    return <String, dynamic>{};
  }

  static Map<String, dynamic> _promotionRuleFromScope(
      Map<String, dynamic> scope) {
    final rawRule = _parseScopeMap(scope['promotion_rule']);
    return <String, dynamic>{
      'kind': (rawRule['kind'] as String? ?? 'standard').trim(),
      'qualifying_quantity':
          (rawRule['qualifying_quantity'] as num?)?.toInt() ?? 1,
      'reward_quantity': (rawRule['reward_quantity'] as num?)?.toInt() ?? 1,
      'qualifying_scope': _parseScopeMap(rawRule['qualifying_scope']),
      'reward_scope': _parseScopeMap(rawRule['reward_scope']),
    };
  }

  static Map<String, dynamic> _promotionScope(
    Map<String, dynamic> eligibleScope,
    String key,
  ) {
    final rule = _promotionRuleFromScope(eligibleScope);
    final scope = _parseScopeMap(rule[key]);
    if (scope.isNotEmpty) {
      return scope;
    }
    return eligibleScope;
  }

  static String _scopeLabelFromMap(Map<String, dynamic> scope) {
    final items = _scopeValues(scope, ['items', 'item_codes']);
    if (items.isNotEmpty) {
      final labels = items.map(_formatScopeValue).toList();
      if (labels.length > 3) {
        return '${labels.take(3).join(', ')} +${labels.length - 3} more';
      }
      return labels.join(', ');
    }

    final subcategories = _scopeValues(scope, ['subcategory_codes']);
    if (subcategories.isNotEmpty) {
      return subcategories.map(_formatScopeValue).join(', ');
    }

    final productKinds =
        _scopeValues(scope, ['product_kind_codes', 'product_kinds']);
    const allMenuProductKinds = {'drink', 'food', 'merchandise', 'candle'};
    final normalizedKinds = productKinds.map(_normalizeScopeValue).toSet();
    if (allMenuProductKinds.every(normalizedKinds.contains)) {
      return 'All menu items';
    }

    final categories = _scopeValues(scope, ['category_codes', 'categories']);
    if (categories.isNotEmpty) {
      return categories.map(_formatScopeValue).join(', ');
    }

    if (productKinds.isNotEmpty) {
      return productKinds.map(_formatScopeValue).join(', ');
    }

    return '';
  }

  static int _countMatchedUnits(
    CartSnapshot snapshot,
    Map<String, dynamic> scope,
  ) {
    var count = 0;
    for (final item in snapshot.items) {
      if (_itemMatchesScope(item, scope)) {
        count += item.quantity;
      }
    }
    return count;
  }

  static int _countMatchedOptionUnits(
    CartSnapshot snapshot,
    Map<String, dynamic> scope,
  ) {
    var count = 0;
    for (final item in snapshot.items) {
      if (!_itemMatchesScope(item, scope)) continue;
      count += item.modifiers
              .where((modifier) => _modifierMatchesOptionScope(modifier, scope))
              .length *
          item.quantity;
    }
    return count;
  }

  static bool _modifierMatchesOptionScope(
    CartModifier modifier,
    Map<String, dynamic> scope,
  ) {
    final groupId = (scope['option_group_id'] as num?)?.toInt();
    final optionIds = _stringListFromScope(scope, ['option_ids'])
        .map(int.tryParse)
        .whereType<int>()
        .toSet();
    if (groupId == null ||
        modifier.optionGroupId != groupId ||
        modifier.optionGroupOptionId == null) {
      return false;
    }
    return optionIds.isEmpty ||
        optionIds.contains(modifier.optionGroupOptionId);
  }

  static bool _itemMatchesScope(
    CartItem item,
    Map<String, dynamic> scope,
  ) {
    final itemCodes = _scopeValues(scope, ['item_codes', 'items'])
        .map(_normalizeScopeValue)
        .where((value) => value.isNotEmpty)
        .toSet();
    final subcategoryCodes = _scopeValues(scope, ['subcategory_codes'])
        .map(_normalizeScopeValue)
        .where((value) => value.isNotEmpty)
        .toSet();
    final categoryCodes = _scopeValues(scope, ['category_codes', 'categories'])
        .map(_normalizeScopeValue)
        .where((value) => value.isNotEmpty)
        .toSet();
    final productKindCodes =
        _scopeValues(scope, ['product_kind_codes', 'product_kinds'])
            .map(_normalizeScopeValue)
            .where((value) => value.isNotEmpty)
            .toSet();

    final hasExplicitScope = itemCodes.isNotEmpty ||
        subcategoryCodes.isNotEmpty ||
        categoryCodes.isNotEmpty ||
        productKindCodes.isNotEmpty;

    if (!hasExplicitScope) {
      return true;
    }

    final productKind = _normalizeScopeValue(item.productKindCode ?? '');
    final categoryCode = _normalizeScopeValue(item.categoryCode ?? '');
    final subcategoryCode = _normalizeScopeValue(item.subcategoryCode ?? '');
    final itemCode = _normalizeScopeValue(item.menuItemCode);
    final itemName = _normalizeScopeValue(item.name);

    // Keep the cart preview consistent with checkout. A specific item is
    // narrower than a menu type, and historic scopes may use item names.
    return itemCodes.isNotEmpty
        ? itemCodes.contains(itemCode) || itemCodes.contains(itemName)
        : subcategoryCodes.isNotEmpty
            ? subcategoryCodes.contains(subcategoryCode)
            : categoryCodes.isNotEmpty
                ? categoryCodes.contains(categoryCode)
                : productKindCodes.contains(productKind);
  }

  static List<String> _scopeValues(
    Map<String, dynamic> scope,
    List<String> keys,
  ) {
    final values = _stringListFromScope(scope, keys);
    return values.length == 1 &&
            _normalizeScopeValue(values.first) ==
                _normalizeScopeValue('All Items')
        ? const <String>[]
        : values;
  }

  static List<String> _stringListFromScope(
    Map<String, dynamic> scope,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = scope[key];
      if (value is List) {
        return value
            .map((item) => item?.toString().trim() ?? '')
            .where((item) => item.isNotEmpty)
            .toList();
      }
      if (value is String && value.trim().isNotEmpty) {
        return [value.trim()];
      }
    }
    return const <String>[];
  }

  static String _formatScopeValue(String value) {
    final normalized = value.replaceAll('_', ' ').trim();
    if (normalized.isEmpty) return value;
    return normalized.split(RegExp(r'\s+')).map((word) {
      if (word.isEmpty) return word;
      return '${word[0].toUpperCase()}${word.substring(1)}';
    }).join(' ');
  }

  static String _normalizeScopeValue(String value) =>
      value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), ' ').trim();

  static String _weekdayName(int weekday) {
    const names = <int, String>{
      DateTime.monday: 'Monday',
      DateTime.tuesday: 'Tuesday',
      DateTime.wednesday: 'Wednesday',
      DateTime.thursday: 'Thursday',
      DateTime.friday: 'Friday',
      DateTime.saturday: 'Saturday',
      DateTime.sunday: 'Sunday',
    };
    return names[weekday] ?? 'Monday';
  }

  static String? _formatTimeLabel(String value) {
    if (value.isEmpty) return null;
    final parts = value.split(':');
    if (parts.length != 2) return value;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return value;
    final suffix = hour >= 12 ? 'PM' : 'AM';
    final normalizedHour = hour % 12 == 0 ? 12 : hour % 12;
    return '$normalizedHour:${minute.toString().padLeft(2, '0')} $suffix';
  }

  static String? _joinTimeRange(String? startTime, String? endTime) {
    if (startTime != null && endTime != null) {
      return '$startTime - $endTime';
    }
    return startTime ?? endTime;
  }

  static String? _formatAnnualDateLabel(String value) {
    if (value.isEmpty) return null;
    final parts = value.split('-');
    if (parts.length != 2) return value;
    final month = int.tryParse(parts[0]);
    final day = int.tryParse(parts[1]);
    if (month == null || day == null) return value;
    const monthNames = <int, String>{
      1: 'Jan',
      2: 'Feb',
      3: 'Mar',
      4: 'Apr',
      5: 'May',
      6: 'Jun',
      7: 'Jul',
      8: 'Aug',
      9: 'Sep',
      10: 'Oct',
      11: 'Nov',
      12: 'Dec',
    };
    return '$day ${monthNames[month] ?? month.toString()}';
  }
}

class RewardVoucher {
  final int id;
  final String status;
  final String issuedReason;
  final String? issueCaseRef;
  final String? tierAtIssue;
  final String rewardKind;
  final String eligibilityStatus;
  final String? unavailableReason;
  final bool hasFixedExpiry;
  final String validityLabel;
  final DateTime issuedAt;
  final DateTime expiresAt;
  final DateTime? redeemedAt;
  final DateTime? revokedAt;
  final String? revokedReason;
  final RewardVoucherTemplate template;

  const RewardVoucher({
    required this.id,
    required this.status,
    required this.issuedReason,
    required this.issueCaseRef,
    required this.tierAtIssue,
    required this.rewardKind,
    this.eligibilityStatus = 'eligible',
    this.unavailableReason,
    required this.hasFixedExpiry,
    required this.validityLabel,
    required this.issuedAt,
    required this.expiresAt,
    required this.redeemedAt,
    required this.revokedAt,
    required this.revokedReason,
    required this.template,
  });

  bool get _isBaseActive =>
      status == 'active' &&
      redeemedAt == null &&
      revokedAt == null &&
      (!hasFixedExpiry || expiresAt.isAfter(DateTime.now()));

  bool get isActive =>
      _isBaseActive &&
      eligibilityStatus != 'unavailable' &&
      template.isAvailableNow;

  bool get isUpcoming =>
      _isBaseActive &&
      eligibilityStatus != 'unavailable' &&
      template.isUpcoming;

  bool get isUnavailable => _isBaseActive && !isActive && !isUpcoming;

  bool get isRedeemed =>
      redeemedAt != null || status == 'redeemed' || status == 'used';

  bool get isTokenCheckoutEligible =>
      isActive && template.isTokenCheckoutCompatible && template.isAvailableNow;

  bool get isDirectCheckoutEligible =>
      isActive &&
      template.isDirectCheckoutCompatible &&
      template.isAvailableNow;

  String get checkoutAvailabilityLabel {
    if (!isActive) {
      if (isUpcoming) return 'Upcoming';
      return 'Unavailable';
    }
    return template.checkoutAvailabilityLabel;
  }

  String get visibilityLabel {
    if (isUpcoming) {
      return 'Upcoming';
    }
    if (!isActive) {
      return 'Unavailable';
    }
    if (!template.isTokenCheckoutCompatible) {
      return 'Not available for checkout';
    }
    return 'Available';
  }

  factory RewardVoucher.fromApi(Map<String, dynamic> json) {
    return RewardVoucher(
      id: (json['id'] as num).toInt(),
      status: json['status'] as String? ?? '',
      issuedReason: json['issued_reason'] as String? ?? '',
      issueCaseRef: json['issue_case_ref'] as String?,
      tierAtIssue: json['tier_at_issue'] as String?,
      rewardKind: json['reward_kind'] as String? ?? 'voucher',
      eligibilityStatus: json['eligibility_status'] as String? ?? 'eligible',
      unavailableReason: json['unavailable_reason'] as String?,
      hasFixedExpiry: json['has_fixed_expiry'] as bool? ?? true,
      validityLabel: json['validity_label'] as String? ?? '',
      issuedAt: _parseApiDate(json['issued_at'] as String),
      expiresAt: _parseApiDate(json['expires_at'] as String),
      redeemedAt: _parseNullableDate(json['redeemed_at'] as String?),
      revokedAt: _parseNullableDate(json['revoked_at'] as String?),
      revokedReason: json['revoked_reason'] as String?,
      template: RewardVoucherTemplate.fromApi(
        Map<String, dynamic>.from(json['template'] as Map),
      ),
    );
  }
}

class TierRewardEntitlement {
  final int id;
  final String status;
  final String issueCaseRef;
  final String tierCode;
  final DateTime unlockedAt;
  final RewardVoucherTemplate template;

  const TierRewardEntitlement({
    required this.id,
    required this.status,
    required this.issueCaseRef,
    required this.tierCode,
    required this.unlockedAt,
    required this.template,
  });

  bool get isClaimable => status == 'claimable';

  factory TierRewardEntitlement.fromApi(Map<String, dynamic> json) {
    return TierRewardEntitlement(
      id: (json['id'] as num).toInt(),
      status: json['status'] as String? ?? '',
      issueCaseRef: json['issue_case_ref'] as String? ?? '',
      tierCode: json['tier_code'] as String? ?? '',
      unlockedAt: _parseApiDate(json['unlocked_at'] as String),
      template: RewardVoucherTemplate.fromApi(
        Map<String, dynamic>.from(json['template'] as Map),
      ),
    );
  }
}

class RewardsCenterSnapshot {
  final List<RewardVoucher> vouchers;
  final List<TierRewardEntitlement> claimableTierRewards;

  const RewardsCenterSnapshot({
    required this.vouchers,
    required this.claimableTierRewards,
  });
}

class CustomerOrderStore {
  final int id;
  final String name;

  const CustomerOrderStore({
    required this.id,
    required this.name,
  });

  factory CustomerOrderStore.fromApi(Map<String, dynamic> json) {
    return CustomerOrderStore(
      id: (json['id'] as num).toInt(),
      name: json['name'] as String? ?? 'Store',
    );
  }
}

class CustomerOrderItem {
  final int id;
  final int menuItemId;
  final String name;
  final String basePriceRm;
  final int? tokenPrice;
  final int quantity;
  final String lineSubtotalRm;
  final int? lineTokenAmount;
  final bool isQualifyingCup;
  final List<CustomerOrderItemModifier> modifiers;

  const CustomerOrderItem({
    required this.id,
    required this.menuItemId,
    required this.name,
    required this.basePriceRm,
    required this.tokenPrice,
    required this.quantity,
    required this.lineSubtotalRm,
    required this.lineTokenAmount,
    required this.isQualifyingCup,
    required this.modifiers,
  });

  factory CustomerOrderItem.fromApi(Map<String, dynamic> json) {
    return CustomerOrderItem(
      id: (json['id'] as num).toInt(),
      menuItemId: (json['menu_item_id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      basePriceRm: json['base_price_rm'] as String? ?? '0.00',
      tokenPrice: (json['token_price'] as num?)?.toInt(),
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      lineSubtotalRm: json['line_subtotal_rm'] as String? ?? '0.00',
      lineTokenAmount: (json['line_token_amount'] as num?)?.toInt(),
      isQualifyingCup: json['is_qualifying_cup'] as bool? ?? false,
      modifiers: (json['modifiers'] as List? ?? const [])
          .map((item) => CustomerOrderItemModifier.fromApi(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
    );
  }
}

class CustomerOrderItemModifier {
  final String groupName;
  final String optionName;
  final String priceDeltaRm;
  final int tokenPriceDelta;

  const CustomerOrderItemModifier({
    required this.groupName,
    required this.optionName,
    required this.priceDeltaRm,
    required this.tokenPriceDelta,
  });

  factory CustomerOrderItemModifier.fromApi(Map<String, dynamic> json) {
    return CustomerOrderItemModifier(
      groupName: json['group_name'] as String? ?? '',
      optionName: json['option_name'] as String? ?? '',
      priceDeltaRm: json['price_delta_rm'] as String? ?? '0.00',
      tokenPriceDelta: (json['token_price_delta'] as num?)?.toInt() ?? 0,
    );
  }
}

class CustomerOrderStatusEvent {
  final String? fromStatus;
  final String toStatus;
  final String? reason;
  final DateTime createdAt;

  const CustomerOrderStatusEvent({
    required this.fromStatus,
    required this.toStatus,
    required this.reason,
    required this.createdAt,
  });

  factory CustomerOrderStatusEvent.fromApi(Map<String, dynamic> json) {
    return CustomerOrderStatusEvent(
      fromStatus: json['from_status'] as String?,
      toStatus: json['to_status'] as String? ?? '',
      reason: json['reason'] as String?,
      createdAt: _parseApiDate(json['created_at'] as String),
    );
  }
}

class CustomerOrder {
  final int id;
  final String orderRef;
  final int dailyOrderNumber;
  final String status;
  final String paymentMode;
  final String? paymentStatus;
  final String? paymentMethod;
  final DateTime? paymentExpiresAt;
  final String finalTotalRm;
  final int tokenAmountCharged;
  final DateTime pickupSlotAt;
  final DateTime? collectedAt;
  final DateTime createdAt;
  final CustomerOrderStore store;
  final int itemCount;
  final String? primaryItemName;
  final String? baristaName;
  final String? baristaUsername;
  final String? cancellationRequestStatus;
  final List<CustomerOrderItem> items;
  final List<CustomerOrderStatusEvent> statusHistory;

  const CustomerOrder({
    required this.id,
    required this.orderRef,
    required this.dailyOrderNumber,
    required this.status,
    required this.paymentMode,
    required this.paymentStatus,
    required this.paymentMethod,
    required this.paymentExpiresAt,
    required this.finalTotalRm,
    required this.tokenAmountCharged,
    required this.pickupSlotAt,
    required this.collectedAt,
    required this.createdAt,
    required this.store,
    required this.itemCount,
    required this.primaryItemName,
    required this.baristaName,
    required this.baristaUsername,
    required this.cancellationRequestStatus,
    required this.items,
    required this.statusHistory,
  });

  CustomerOrder copyWith({
    String? status,
    List<CustomerOrderStatusEvent>? statusHistory,
    String? cancellationRequestStatusOverride,
  }) {
    return CustomerOrder(
      id: id,
      orderRef: orderRef,
      dailyOrderNumber: dailyOrderNumber,
      status: status ?? this.status,
      paymentMode: paymentMode,
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
      paymentExpiresAt: paymentExpiresAt,
      finalTotalRm: finalTotalRm,
      tokenAmountCharged: tokenAmountCharged,
      pickupSlotAt: pickupSlotAt,
      collectedAt: collectedAt,
      createdAt: createdAt,
      store: store,
      itemCount: itemCount,
      primaryItemName: primaryItemName,
      baristaName: baristaName,
      baristaUsername: baristaUsername,
      cancellationRequestStatus:
          cancellationRequestStatusOverride ?? cancellationRequestStatus,
      items: items,
      statusHistory: statusHistory ?? this.statusHistory,
    );
  }

  bool get isActive {
    switch (status) {
      case 'pending_payment':
      case 'paid':
      case 'accepted':
      case 'preparing':
      case 'ready_for_pickup':
        return true;
      default:
        return false;
    }
  }

  factory CustomerOrder.fromApi(Map<String, dynamic> json) {
    return CustomerOrder(
      id: (json['id'] as num).toInt(),
      orderRef: json['order_ref'] as String? ?? '',
      dailyOrderNumber: (json['daily_order_number'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? '',
      paymentMode: json['payment_mode'] as String? ?? '',
      paymentStatus: json['payment_status'] as String?,
      paymentMethod: json['payment_method'] as String?,
      paymentExpiresAt:
          _parseNullableDate(json['payment_expires_at'] as String?),
      finalTotalRm: json['final_total_rm'] as String? ?? '0.00',
      tokenAmountCharged: (json['token_amount_charged'] as num?)?.toInt() ?? 0,
      pickupSlotAt: _parseApiDate(json['pickup_slot_at'] as String),
      collectedAt: _parseNullableDate(json['collected_at'] as String?),
      createdAt: _parseApiDate(json['created_at'] as String),
      store: CustomerOrderStore.fromApi(
        Map<String, dynamic>.from(json['store'] as Map),
      ),
      itemCount: (json['item_count'] as num?)?.toInt() ?? 0,
      primaryItemName: json['primary_item_name'] as String?,
      baristaName: json['barista_name'] as String?,
      baristaUsername: json['barista_username'] as String?,
      cancellationRequestStatus: json['cancellation_request_status'] as String?,
      items: (json['items'] as List? ?? const [])
          .map((item) => CustomerOrderItem.fromApi(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
      statusHistory: (json['status_history'] as List? ?? const [])
          .map((item) => CustomerOrderStatusEvent.fromApi(
                Map<String, dynamic>.from(item as Map),
              ))
          .toList(),
    );
  }
}

class CustomerOrdersSnapshot {
  final CustomerOrder? activeOrder;
  final List<CustomerOrder> orders;

  const CustomerOrdersSnapshot({
    required this.activeOrder,
    required this.orders,
  });
}

class ReferralSnapshot {
  final String referralCode;
  final String shareUrl;
  final String androidDownloadUrl;
  final String iosDownloadUrl;
  final int friendsInvited;
  final int rewardsClaimed;
  final bool hasClaimedReferrer;
  final bool isEligibleToClaim;
  final String? claimedCode;
  final String? activeProgramName;
  final int? qualificationDays;
  final String? friendRewardType;
  final int? friendTokenAmount;
  final String? friendRewardLabel;
  final String? referrerRewardLabel;

  const ReferralSnapshot({
    required this.referralCode,
    required this.shareUrl,
    required this.androidDownloadUrl,
    required this.iosDownloadUrl,
    required this.friendsInvited,
    required this.rewardsClaimed,
    required this.hasClaimedReferrer,
    this.isEligibleToClaim = true,
    this.claimedCode,
    this.activeProgramName,
    this.qualificationDays,
    this.friendRewardType,
    this.friendTokenAmount,
    this.friendRewardLabel,
    this.referrerRewardLabel,
  });

  factory ReferralSnapshot.fromApi(Map<String, dynamic> json) {
    return ReferralSnapshot(
      referralCode: (json['referral_code'] as String?) ?? 'C2-MEMBER',
      shareUrl: (json['share_url'] as String?) ?? 'https://c2coffee.app',
      androidDownloadUrl: (json['android_download_url'] as String?) ??
          'https://play.google.com/store/apps/details?id=com.c2coffeeandcandle.customer',
      iosDownloadUrl: (json['ios_download_url'] as String?) ??
          'https://apps.apple.com/my/app/c2-coffee/id6809305739',
      friendsInvited: (json['friends_invited'] as num?)?.toInt() ?? 0,
      rewardsClaimed: (json['rewards_claimed'] as num?)?.toInt() ?? 0,
      hasClaimedReferrer: (json['has_claimed_referrer'] as bool?) ?? false,
      isEligibleToClaim: (json['is_eligible_to_claim'] as bool?) ?? false,
      claimedCode: json['claimed_code'] as String?,
      activeProgramName: (json['active_program'] as Map?)?['name'] as String?,
      qualificationDays:
          ((json['active_program'] as Map?)?['qualification_days'] as num?)
              ?.toInt(),
      friendRewardType:
          (json['active_program'] as Map?)?['friend_reward_type'] as String?,
      friendTokenAmount:
          ((json['active_program'] as Map?)?['friend_token_amount'] as num?)
              ?.toInt(),
      friendRewardLabel:
          (json['active_program'] as Map?)?['friend_reward_label'] as String?,
      referrerRewardLabel:
          (json['active_program'] as Map?)?['referrer_reward_label'] as String?,
    );
  }
}

class CustomerDataService {
  CustomerDataService._();

  static final CustomerDataService instance = CustomerDataService._();

  final http.Client _client = http.Client();

  Future<EmployeeSubsidy> getSubsidy({
    required String accessToken,
    int? storeId,
  }) async =>
      EmployeeSubsidy.fromApi(await _get(
        storeId == null ? '/subsidy' : '/subsidy?store_id=$storeId',
        accessToken: accessToken,
      ));
  Future<EmployeeSubsidy> updateSubsidy(
          {required String accessToken,
          required bool enabled,
          int? storeId}) async =>
      EmployeeSubsidy.fromApi(
          await _put('/subsidy', accessToken: accessToken, body: {
        'enabled': enabled,
        if (storeId != null) 'store_id': storeId,
      }));

  Future<List<WalletTransaction>> getWalletTransactions({
    required String accessToken,
    int limit = 20,
  }) async {
    final response = await _get(
      '/wallet/transactions?limit=$limit',
      accessToken: accessToken,
    );

    return (response['transactions'] as List? ?? const [])
        .map((item) => WalletTransaction.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();
  }

  Future<List<GiftCard>> getGiftCards({
    required String accessToken,
    bool includeHistory = false,
  }) async {
    final response = await _get(
      '/gift-cards${includeHistory ? '?include_history=true' : ''}',
      accessToken: accessToken,
    );
    return (response['gift_cards'] as List? ?? const [])
        .map((item) => GiftCard.fromApi(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<GiftCardPurchase> purchaseGiftCard({
    required String accessToken,
    required String currency,
    required num amount,
    String? recipientPhone,
    String? recipientMessage,
    String? paymentMethod,
    required String idempotencyKey,
  }) async {
    final response = await _post(
      '/gift-cards',
      accessToken: accessToken,
      headers: {'Idempotency-Key': idempotencyKey},
      body: {
        'currency': currency,
        'amount': amount,
        if (recipientPhone != null && recipientPhone.trim().isNotEmpty)
          'recipient_phone': recipientPhone.trim(),
        'recipient_message': recipientMessage,
        if (paymentMethod != null) 'payment_method': paymentMethod,
      },
    );
    return GiftCardPurchase.fromApi(response);
  }

  Future<OnlineTopUpPaymentMethods> getGiftCardPaymentMethods({
    required String accessToken,
  }) async {
    final response = await _get(
      '/gift-cards/payment-methods',
      accessToken: accessToken,
    );
    return OnlineTopUpPaymentMethods.fromApi(response);
  }

  Future<String> getGiftCardPurchaseStatus({
    required String accessToken,
    required String purchaseRef,
  }) async {
    final response = await _get(
      '/gift-cards/purchases/${Uri.encodeComponent(purchaseRef)}',
      accessToken: accessToken,
    );
    return response['status'] as String? ?? 'pending_payment';
  }

  Future<void> claimGiftCard({
    required String accessToken,
    required String code,
  }) async {
    await _post('/gift-cards/claim',
        accessToken: accessToken, body: {'code': code});
  }

  Future<OnlineTopUpPaymentMethods> getChipPaymentMethods({
    required String accessToken,
  }) async {
    final response = await _get(
      '/topups/payment-methods',
      accessToken: accessToken,
    );
    return OnlineTopUpPaymentMethods.fromApi(response);
  }

  Future<List<TokenTopUpPackage>> getTopUpPackages(
      {required String accessToken}) async {
    final response = await _get('/topups/packages', accessToken: accessToken);
    return (response['packages'] as List? ?? const [])
        .map((item) =>
            TokenTopUpPackage.fromApi(Map<String, dynamic>.from(item as Map)))
        .where((item) => item.id > 0 && item.tokenAmount > 0)
        .toList();
  }

  Future<OnlineTopUpSession> startChipTopUp({
    required String accessToken,
    required int amountRm,
    required String paymentMethod,
  }) async {
    final response = await _post(
      '/topups',
      accessToken: accessToken,
      body: {
        'amount_rm': amountRm,
        'payment_method': paymentMethod,
      },
    );
    return OnlineTopUpSession.fromApi(response);
  }

  Future<OnlineTopUpSession> getOnlineTopUp({
    required String accessToken,
    required String topupRef,
  }) async {
    final response = await _get('/topups/$topupRef', accessToken: accessToken);
    return OnlineTopUpSession.fromApi(response);
  }

  Future<List<RewardVoucher>> getRewardVouchers({
    required String accessToken,
    int limit = 50,
    bool onlyActive = true,
    bool onlyTokenCheckoutEligible = false,
    bool includeHistory = false,
    bool includeTierRewards = false,
  }) async {
    final response = await _get(
      '/rewards/vouchers?limit=$limit${includeHistory ? '&include_history=true' : ''}${includeTierRewards ? '&include_tier_rewards=true' : ''}',
      accessToken: accessToken,
    );

    return (response['vouchers'] as List? ?? const [])
        .map((item) => RewardVoucher.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .where((voucher) =>
            voucher.status != 'revoked' && voucher.revokedAt == null)
        .where((voucher) => !onlyActive || voucher.isActive)
        .where(
          (voucher) =>
              !onlyTokenCheckoutEligible || voucher.isTokenCheckoutEligible,
        )
        .toList();
  }

  Future<RewardsCenterSnapshot> getRewardsCenter({
    required String accessToken,
    int limit = 50,
    bool includeHistory = false,
  }) async {
    final response = await _get(
      '/rewards/vouchers?limit=$limit${includeHistory ? '&include_history=true' : ''}',
      accessToken: accessToken,
    );

    final rewardRows = <dynamic>[
      ...(response['vouchers'] as List? ?? const []),
      ...(response['locked_topup_rewards'] as List? ?? const []),
    ];
    final parsedVouchers = rewardRows
        .map((item) => RewardVoucher.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        // Revoked rewards are administrative invalidations, not customer
        // history. Do not expose them in My Rewards at all.
        .where((voucher) =>
            voucher.status != 'revoked' && voucher.revokedAt == null)
        .toList();
    final vouchersByTemplate = <String, RewardVoucher>{};
    int displayPriority(RewardVoucher voucher) {
      if (voucher.isActive) return 3;
      if (voucher.isUpcoming) return 2;
      return 1;
    }

    for (final voucher in parsedVouchers) {
      final key = voucher.template.code.trim().toLowerCase();
      final existing = vouchersByTemplate[key];
      if (existing == null ||
          displayPriority(voucher) > displayPriority(existing) ||
          (displayPriority(voucher) == displayPriority(existing) &&
              voucher.issuedAt.isAfter(existing.issuedAt))) {
        vouchersByTemplate[key] = voucher;
      }
    }
    final vouchers = vouchersByTemplate.values.toList();
    final claimableTierRewards =
        (response['claimable_tier_rewards'] as List? ?? const [])
            .map((item) => TierRewardEntitlement.fromApi(
                  Map<String, dynamic>.from(item as Map),
                ))
            .where((reward) => reward.isClaimable)
            .toList();

    return RewardsCenterSnapshot(
      vouchers: vouchers,
      claimableTierRewards: claimableTierRewards,
    );
  }

  Future<int> claimTierReward({
    required String accessToken,
    required int entitlementId,
  }) async {
    final response = await _post(
      '/rewards/tier-entitlements/$entitlementId/claim',
      accessToken: accessToken,
      body: const {},
    );
    return (response['user_voucher_id'] as num).toInt();
  }

  Future<CustomerOrdersSnapshot> getOrders({
    required String accessToken,
    int limit = 20,
  }) async {
    final response = await _get(
      '/orders?limit=$limit',
      accessToken: accessToken,
    );

    final activeOrderMap = response['active_order'];
    final orders = (response['orders'] as List? ?? const [])
        .map((item) => CustomerOrder.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .toList();

    return CustomerOrdersSnapshot(
      activeOrder: activeOrderMap is Map<String, dynamic>
          ? CustomerOrder.fromApi(activeOrderMap)
          : null,
      orders: orders,
    );
  }

  Future<Map<String, dynamic>> cancelOrder({
    required String accessToken,
    required int orderId,
  }) {
    return _post(
      '/orders/$orderId/cancel',
      accessToken: accessToken,
      body: const {},
    );
  }

  Future<Map<String, dynamic>> requestOrderCancellation({
    required String accessToken,
    required int orderId,
    String? reason,
  }) {
    return _post(
      '/orders/$orderId/cancellation-request',
      accessToken: accessToken,
      body: {
        'reason':
            reason ?? 'Customer requested cancellation before preparation.'
      },
    );
  }

  Future<Map<String, dynamic>> getOrderPayment({
    required String accessToken,
    required int orderId,
  }) {
    return _get(
      '/orders/$orderId/payment',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> retryOrderPayment({
    required String accessToken,
    required int orderId,
    required String paymentMethod,
  }) {
    return _post(
      '/orders/$orderId/payment/retry',
      accessToken: accessToken,
      body: {'payment_method': paymentMethod},
    );
  }

  Future<ReferralSnapshot> getReferralInfo({
    required String accessToken,
  }) async {
    final response = await _get(
      '/referrals',
      accessToken: accessToken,
    );
    return ReferralSnapshot.fromApi(response);
  }

  Future<void> claimReferralCode({
    required String accessToken,
    required String code,
  }) async {
    await _post(
      '/referrals/claim',
      accessToken: accessToken,
      body: {'code': code},
    );
  }

  Future<Map<String, dynamic>> _post(
    String path, {
    required String accessToken,
    required Map<String, dynamic> body,
    Map<String, String> headers = const {},
  }) async {
    http.Response response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
            ...headers,
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));

    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await _client
            .post(
              Uri.parse('${ApiConfig.baseUrl}$path'),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $refreshed',
                ...headers,
              },
              body: jsonEncode(body),
            )
            .timeout(const Duration(seconds: 20));
      }
    }

    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Map<String, dynamic>.from(decoded as Map);
    }

    final data = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = data['error'];
    if (error is Map<String, dynamic>) {
      throw ApiException(
        (error['message'] as String?) ?? 'Request failed.',
        code: error['code'] as String?,
      );
    }

    throw ApiException('Request failed with status ${response.statusCode}.');
  }

  Future<Map<String, dynamic>> _put(
    String path, {
    required String accessToken,
    required Map<String, dynamic> body,
  }) async {
    Future<http.Response> send(String token) => _client
        .put(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 20));

    http.Response response = await send(accessToken);
    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await send(refreshed);
      }
    }
    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Map<String, dynamic>.from(decoded as Map);
    }
    final data = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = data['error'];
    throw ApiException(
      error is Map
          ? (error['message'] as String? ?? 'Request failed.')
          : 'Request failed with status ${response.statusCode}.',
      code: error is Map ? error['code'] as String? : null,
    );
  }

  Future<Map<String, dynamic>> _get(
    String path, {
    required String accessToken,
  }) async {
    http.Response response = await _client.get(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await _client.get(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $refreshed',
          },
        ).timeout(const Duration(seconds: 15));
      }
    }

    final text = utf8.decode(response.bodyBytes);
    final decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return Map<String, dynamic>.from(decoded as Map);
    }

    final body = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};
    final error = body['error'];
    if (error is Map<String, dynamic>) {
      throw ApiException(
        (error['message'] as String?) ?? 'Request failed.',
        code: error['code'] as String?,
      );
    }

    throw ApiException('Request failed with status ${response.statusCode}.');
  }
}

DateTime? _parseNullableDate(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.parse(value).toLocal();
}

DateTime _parseApiDate(String value) {
  return DateTime.parse(value).toLocal();
}
