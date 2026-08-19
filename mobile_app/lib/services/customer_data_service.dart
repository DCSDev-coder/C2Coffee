import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'auth_api_service.dart';
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
  final String voucherType;
  final String discountMode;
  final String discountValue;
  final int? tokenValue;
  final String? minSpendRm;
  final bool requiresDrinkInCart;

  const RewardVoucherTemplate({
    required this.code,
    required this.name,
    required this.voucherType,
    required this.discountMode,
    required this.discountValue,
    required this.tokenValue,
    required this.minSpendRm,
    required this.requiresDrinkInCart,
  });

  factory RewardVoucherTemplate.fromApi(Map<String, dynamic> json) {
    return RewardVoucherTemplate(
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      voucherType: json['voucher_type'] as String? ?? '',
      discountMode: json['discount_mode'] as String? ?? '',
      discountValue: json['discount_value'] as String? ?? '0.00',
      tokenValue: (json['token_value'] as num?)?.toInt(),
      minSpendRm: json['min_spend_rm'] as String?,
      requiresDrinkInCart: json['requires_drink_in_cart'] as bool? ?? false,
    );
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
  }) async {
    final response = await _get(
      '/rewards/vouchers?limit=$limit',
      accessToken: accessToken,
    );

    return (response['vouchers'] as List? ?? const [])
        .map((item) => RewardVoucher.fromApi(
              Map<String, dynamic>.from(item as Map),
            ))
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
    String provider = 'touch_n_go_sandbox',
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
    http.Response response = await _client.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $accessToken',
      },
      body: jsonEncode(body),
    ).timeout(const Duration(seconds: 20));

    if (response.statusCode == 401) {
      final refreshed =
          await SecureSessionService.instance.refreshTokenSilently();
      if (refreshed != null && refreshed.isNotEmpty) {
        response = await _client.post(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $refreshed',
          },
          body: jsonEncode(body),
        ).timeout(const Duration(seconds: 20));
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
