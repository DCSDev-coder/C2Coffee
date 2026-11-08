import 'dart:math';

class SubsidyCheckoutBreakdown {
  const SubsidyCheckoutBreakdown._({
    required this.personalBalance,
    required this.subsidyApplied,
    required this.personalRequired,
  });

  final int personalBalance;
  final int subsidyApplied;
  final int personalRequired;

  int get availableForOrder => personalBalance + subsidyApplied;
  bool get canPay => personalBalance >= personalRequired;

  static SubsidyCheckoutBreakdown calculate({
    required int combinedBalance,
    required int totalCharge,
    required int drinkCharge,
    required int priorDeductions,
    required bool subsidyEligible,
    required bool subsidyEnabled,
    required int? subsidyRemaining,
    bool subsidyUnlimited = false,
    bool subsidyBlocked = false,
  }) {
    final safeTotal = max(0, totalCharge);
    final safeRemaining = subsidyEligible && !subsidyUnlimited
        ? max(0, subsidyRemaining ?? 0)
        : 0;
    final personalBalance = max(0, combinedBalance - safeRemaining);
    final eligibleCharge = min(
      safeTotal,
      max(0, drinkCharge - max(0, priorDeductions)),
    ).toInt();
    final subsidyApplied = subsidyEligible && subsidyEnabled && !subsidyBlocked
        ? subsidyUnlimited ? eligibleCharge : min(safeRemaining, eligibleCharge)
        : 0;

    return SubsidyCheckoutBreakdown._(
      personalBalance: personalBalance,
      subsidyApplied: subsidyApplied,
      personalRequired: max(0, safeTotal - subsidyApplied),
    );
  }
}
