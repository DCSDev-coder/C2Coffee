export type OrderPriceCorrectionSplit = {
  originalSubsidyTokenAmount: number;
  originalPersonalTokenAmount: number;
  correctedSubsidyTokenAmount: number;
  correctedPersonalTokenAmount: number;
  subsidyCorrectionTokenAmount: number;
  personalCorrectionTokenAmount: number;
  correctionTokenAmount: number;
};

export function splitOrderPriceCorrection(input: {
  originalTokenAmount: number;
  correctedTokenAmount: number;
  originalSubsidyTokenAmount: number;
}): OrderPriceCorrectionSplit {
  const originalTokenAmount = Math.max(0, Math.trunc(input.originalTokenAmount));
  const correctedTokenAmount = Math.max(0, Math.min(originalTokenAmount, Math.trunc(input.correctedTokenAmount)));
  const originalSubsidyTokenAmount = Math.max(
    0,
    Math.min(originalTokenAmount, Math.trunc(input.originalSubsidyTokenAmount))
  );
  const originalPersonalTokenAmount = originalTokenAmount - originalSubsidyTokenAmount;

  // Checkout consumes company subsidy first, then personal credit. Rebuild that
  // same funding order at the corrected total so the returned amounts remain
  // accurate even when an order crossed the subsidy/personal boundary.
  const correctedSubsidyTokenAmount = Math.min(correctedTokenAmount, originalSubsidyTokenAmount);
  const correctedPersonalTokenAmount = correctedTokenAmount - correctedSubsidyTokenAmount;
  const subsidyCorrectionTokenAmount = originalSubsidyTokenAmount - correctedSubsidyTokenAmount;
  const personalCorrectionTokenAmount = originalPersonalTokenAmount - correctedPersonalTokenAmount;

  return {
    originalSubsidyTokenAmount,
    originalPersonalTokenAmount,
    correctedSubsidyTokenAmount,
    correctedPersonalTokenAmount,
    subsidyCorrectionTokenAmount,
    personalCorrectionTokenAmount,
    correctionTokenAmount: originalTokenAmount - correctedTokenAmount
  };
}
