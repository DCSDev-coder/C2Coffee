import 'dart:convert';

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

class RewardVoucherTemplate {
  final String code;
  final String name;
  final String typeLabel;
  final String benefitType;
  final String audience;
  final String voucherType;
  final String discountMode;
  final String discountValue;
  final int? tokenValue;
  final String? minSpendRm;
  final bool requiresDrinkInCart;
  final Map<String, dynamic> eligibleScope;
  final Map<String, dynamic> excludeScope;
  final Map<String, dynamic> promotionRule;

  const RewardVoucherTemplate({
    required this.code,
    required this.name,
    required this.typeLabel,
    required this.benefitType,
    required this.audience,
    required this.voucherType,
    required this.discountMode,
    required this.discountValue,
    required this.tokenValue,
    required this.minSpendRm,
    required this.requiresDrinkInCart,
    required this.eligibleScope,
    required this.excludeScope,
    required this.promotionRule,
  });

  factory RewardVoucherTemplate.fromApi(Map<String, dynamic> json) {
    return RewardVoucherTemplate(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      typeLabel: _parseScopeMap(json['eligible_scope_json'])['type_label']
              as String? ??
          '',
      benefitType: _parseScopeMap(json['eligible_scope_json'])['benefit_type']
              as String? ??
          '',
      audience:
          _parseScopeMap(json['eligible_scope_json'])['audience'] as String? ??
              'all_customers',
      voucherType: json['voucher_type'] as String? ?? '',
      discountMode: json['discount_mode'] as String? ?? '',
      discountValue: json['discount_value'] as String? ?? '0.00',
      tokenValue: (json['token_value'] as num?)?.toInt(),
      minSpendRm: json['min_spend_rm'] as String?,
      requiresDrinkInCart: json['requires_drink_in_cart'] as bool? ?? false,
      eligibleScope: _parseScopeMap(json['eligible_scope_json']),
      excludeScope: _parseScopeMap(json['exclude_scope_json']),
      promotionRule:
          _promotionRuleFromScope(_parseScopeMap(json['eligible_scope_json'])),
    );
  }

  String get displayLabel => name.trim().isNotEmpty ? name : typeLabel;

  String get benefitLabel {
    if (benefitType.trim().isNotEmpty) {
      return benefitType;
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
      default:
        return 'Voucher';
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
    switch (discountMode) {
      case 'fixed_rm':
      case 'percent_rm':
      case 'fixed_token':
      case 'free_drink':
        return true;
      default:
        return false;
    }
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
      final activeDays = (schedule['activeDays'] as List? ?? const [])
          .map((day) => day?.toString().trim() ?? '')
          .where((day) => day.isNotEmpty)
          .toList();
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

  bool matchesCartSnapshot(CartSnapshot snapshot) {
    final promotionKind =
        (promotionRule['kind'] as String? ?? 'standard').trim();
    final qualifyingQty =
        (promotionRule['qualifying_quantity'] as num?)?.toInt() ?? 1;
    final rewardQty = (promotionRule['reward_quantity'] as num?)?.toInt() ?? 1;
    final qualifyingScope = _promotionScope(eligibleScope, 'qualifying_scope');
    final rewardScope = _promotionScope(eligibleScope, 'reward_scope');

    final qualifyingMatchCount = _countMatchedUnits(snapshot, qualifyingScope);
    if (qualifyingMatchCount < qualifyingQty) {
      return false;
    }

    if (promotionKind == 'bundle') {
      return _countMatchedUnits(snapshot, rewardScope) >= rewardQty;
    }

    return qualifyingMatchCount > 0;
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
      final activeDays = (schedule['activeDays'] as List? ?? const [])
          .map((day) => day?.toString().trim() ?? '')
          .where((day) => day.isNotEmpty)
          .toList();
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
          ? 'On customer birthday'
          : 'On customer birthday, $timeLabel';
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
    final productKinds =
        _scopeValues(scope, ['product_kind_codes', 'product_kinds']);
    const allMenuProductKinds = {'drink', 'food', 'merchandise', 'candle'};
    final normalizedKinds = productKinds
        .map(_normalizeScopeValue)
        .toSet();
    if (allMenuProductKinds.every(normalizedKinds.contains)) {
      return 'All menu items';
    }

    final items = _scopeValues(scope, ['items', 'item_codes']);
    if (items.isNotEmpty) {
      final labels = items.map(_formatScopeValue).toList();
      if (labels.length > 3) {
        return '${labels.take(3).join(', ')} +${labels.length - 3} more';
      }
      return labels.join(', ');
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
      return snapshot.items.fold<int>(0, (sum, item) => sum + item.quantity);
    }

    var count = 0;
    for (final item in snapshot.items) {
      final productKind = _normalizeScopeValue(item.productKindCode ?? '');
      final categoryCode = _normalizeScopeValue(item.categoryCode ?? '');
      final subcategoryCode = _normalizeScopeValue(item.subcategoryCode ?? '');
      final itemCode = _normalizeScopeValue(item.menuItemCode);

      if (itemCodes.contains(itemCode) ||
          subcategoryCodes.contains(subcategoryCode) ||
          categoryCodes.contains(categoryCode) ||
          productKindCodes.contains(productKind)) {
        count += item.quantity;
      }
    }

    return count;
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
    required this.issuedAt,
    required this.expiresAt,
    required this.redeemedAt,
    required this.revokedAt,
    required this.revokedReason,
    required this.template,
  });

  bool get isActive => status == 'active';

  bool get isRedeemed =>
      redeemedAt != null || status == 'redeemed' || status == 'used';

  bool get isTokenCheckoutEligible =>
      isActive && template.isTokenCheckoutCompatible && template.isAvailableNow;

  String get checkoutAvailabilityLabel {
    if (!isActive) {
      return 'Inactive / expired';
    }
    return template.checkoutAvailabilityLabel;
  }

  String get visibilityLabel {
    if (!isActive) {
      return 'Inactive / expired';
    }
    if (!template.isTokenCheckoutCompatible) {
      return 'Not available for checkout';
    }
    if (!template.isAvailableNow) {
      return 'Active, but outside promotion time';
    }
    return 'Ready to use';
  }

  factory RewardVoucher.fromApi(Map<String, dynamic> json) {
    return RewardVoucher(
      id: (json['id'] as num).toInt(),
      status: json['status'] as String? ?? '',
      issuedReason: json['issued_reason'] as String? ?? '',
      issueCaseRef: json['issue_case_ref'] as String?,
      tierAtIssue: json['tier_at_issue'] as String?,
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
  final List<CustomerOrderItem> items;
  final List<CustomerOrderStatusEvent> statusHistory;

  const CustomerOrder({
    required this.id,
    required this.orderRef,
    required this.dailyOrderNumber,
    required this.status,
    required this.paymentMode,
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
    required this.items,
    required this.statusHistory,
  });

  CustomerOrder copyWith({
    String? status,
    List<CustomerOrderStatusEvent>? statusHistory,
  }) {
    return CustomerOrder(
      id: id,
      orderRef: orderRef,
      dailyOrderNumber: dailyOrderNumber,
      status: status ?? this.status,
      paymentMode: paymentMode,
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
  final int friendsInvited;
  final int rewardsClaimed;
  final bool hasClaimedReferrer;
  final bool isEligibleToClaim;
  final String? claimedCode;

  const ReferralSnapshot({
    required this.referralCode,
    required this.shareUrl,
    required this.friendsInvited,
    required this.rewardsClaimed,
    required this.hasClaimedReferrer,
    this.isEligibleToClaim = true,
    this.claimedCode,
  });

  factory ReferralSnapshot.fromApi(Map<String, dynamic> json) {
    return ReferralSnapshot(
      referralCode: (json['referral_code'] as String?) ?? 'C2-MEMBER',
      shareUrl: (json['share_url'] as String?) ?? 'https://c2coffee.app',
      friendsInvited: (json['friends_invited'] as num?)?.toInt() ?? 0,
      rewardsClaimed: (json['rewards_claimed'] as num?)?.toInt() ?? 0,
      hasClaimedReferrer: (json['has_claimed_referrer'] as bool?) ?? false,
      isEligibleToClaim: (json['is_eligible_to_claim'] as bool?) ?? false,
      claimedCode: json['claimed_code'] as String?,
    );
  }
}

class CustomerDataService {
  CustomerDataService._();

  static final CustomerDataService instance = CustomerDataService._();

  final http.Client _client = http.Client();

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

  Future<List<RewardVoucher>> getRewardVouchers({
    required String accessToken,
    int limit = 50,
    bool onlyActive = true,
    bool onlyTokenCheckoutEligible = false,
  }) async {
    final response = await _get(
      '/rewards/vouchers?limit=$limit',
      accessToken: accessToken,
    );

    return (response['vouchers'] as List? ?? const [])
        .map((item) => RewardVoucher.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
        .where((voucher) => !voucher.isRedeemed)
        .where((voucher) => !onlyActive || voucher.isActive)
        .where(
          (voucher) =>
              !onlyTokenCheckoutEligible || voucher.isTokenCheckoutEligible,
        )
        .toList();
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

  Future<Map<String, dynamic>> topUpWallet({
    required String accessToken,
    required int tokenAmount,
    String provider = 'touch_n_go',
  }) async {
    return _post(
      '/wallet/topup',
      accessToken: accessToken,
      body: {
        'token_amount': tokenAmount,
        'provider': provider,
      },
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
  }) async {
    http.Response response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
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
