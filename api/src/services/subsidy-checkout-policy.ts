export function allocateSubsidyEligibleDrinkTokens(input: {
  totalTokens: number;
  drinkTokens: number;
  priorDeductions: number;
}): number {
  const totalTokens = Math.max(0, Math.floor(input.totalTokens));
  const drinkTokens = Math.max(0, Math.floor(input.drinkTokens));
  const priorDeductions = Math.max(0, Math.floor(input.priorDeductions));

  // Apply vouchers and token gift cards to drink spend first. This is
  // deliberately conservative: company subsidy must never be redirected to
  // food or merchandise after another credit removes the drink charge.
  return Math.min(totalTokens, Math.max(0, drinkTokens - priorDeductions));
}
