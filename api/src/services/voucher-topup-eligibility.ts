export type VoucherTopUpEligibility = {
  required: boolean;
  eligible: boolean;
  minimumTokens: number | null;
  unavailableReason: string | null;
};

export function getVoucherTopUpMinimum(
  scope: Record<string, unknown>
): number | null {
  const rawRule = scope.topup_reward;
  if (!rawRule || typeof rawRule !== 'object' || Array.isArray(rawRule)) {
    return null;
  }

  const minimumTokens = Number(
    (rawRule as Record<string, unknown>).min_tokens
  );
  return Number.isInteger(minimumTokens) && minimumTokens > 0
    ? minimumTokens
    : null;
}

export function evaluateVoucherTopUpEligibility(input: {
  scope: Record<string, unknown>;
  templateId: number;
  issueCaseRef: string | null;
  issuedByType: string | null;
}): VoucherTopUpEligibility {
  const minimumTokens = getVoucherTopUpMinimum(input.scope);
  if (minimumTokens === null) {
    return {
      required: false,
      eligible: true,
      minimumTokens: null,
      unavailableReason: null
    };
  }

  // An explicit admin issue is an intentional override. System-issued copies
  // must carry the qualifying top-up reference produced by settlement.
  const expectedPrefix = `topup_reward:${input.templateId}:topup:`;
  const eligible = input.issuedByType === 'admin' ||
    input.issueCaseRef?.startsWith(expectedPrefix) === true;

  return {
    required: true,
    eligible,
    minimumTokens,
    unavailableReason: eligible
      ? null
      : `Top up at least ${minimumTokens} C2 Tokens in one payment to unlock this voucher.`
  };
}
