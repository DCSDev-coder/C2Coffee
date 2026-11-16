export type WeightedRefundLine = { id: number; weight: number };

export function allocateIntegerTotal(total: number, lines: WeightedRefundLine[]): Map<number, number> {
  const normalizedTotal = Math.max(0, Math.floor(total));
  const normalized = lines.map((line) => ({ id: line.id, weight: Math.max(0, Math.floor(line.weight)) }));
  const totalWeight = normalized.reduce((sum, line) => sum + line.weight, 0);
  const allocations = new Map<number, number>();
  if (normalizedTotal === 0 || totalWeight === 0) {
    for (const line of normalized) allocations.set(line.id, 0);
    return allocations;
  }
  const ranked = normalized.map((line) => {
    const raw = normalizedTotal * line.weight / totalWeight;
    return { id: line.id, floor: Math.floor(raw), remainder: raw - Math.floor(raw) };
  });
  let unallocated = normalizedTotal - ranked.reduce((sum, line) => sum + line.floor, 0);
  ranked.sort((a, b) => b.remainder - a.remainder || a.id - b.id);
  for (const line of ranked) {
    const bonus = unallocated > 0 ? 1 : 0;
    allocations.set(line.id, line.floor + bonus);
    unallocated -= bonus;
  }
  return allocations;
}

export function incrementalQuantityAllocation(
  lineTotal: number,
  orderedQuantity: number,
  alreadyRefundedQuantity: number,
  requestedQuantity: number
): number {
  const total = Math.max(0, Math.floor(lineTotal));
  const ordered = Math.max(1, Math.floor(orderedQuantity));
  const already = Math.max(0, Math.min(ordered, Math.floor(alreadyRefundedQuantity)));
  const requested = Math.max(0, Math.min(ordered - already, Math.floor(requestedQuantity)));
  const base = Math.floor(total / ordered);
  const remainderUnits = total % ordered;
  const cumulative = (quantity: number) => base * quantity + Math.min(quantity, remainderUnits);
  return cumulative(already + requested) - cumulative(already);
}
