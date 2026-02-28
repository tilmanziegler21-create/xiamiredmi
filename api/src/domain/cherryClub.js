export function getCherryTier(cherries) {
  const c = Math.max(0, Math.round(Number(cherries || 0)));
  if (c >= 100) return { key: 'legend', title: 'LEGEND', min: 100, permanentDiscountPercent: 20, extraCherriesPerOrder: 3 };
  if (c >= 50) return { key: 'platinum', title: 'PLATINUM', min: 50, permanentDiscountPercent: 15, extraCherriesPerOrder: 2 };
  if (c >= 25) return { key: 'gold', title: 'GOLD', min: 25, permanentDiscountPercent: 10, extraCherriesPerOrder: 1 };
  if (c >= 10) return { key: 'silver', title: 'SILVER', min: 10, permanentDiscountPercent: 5, extraCherriesPerOrder: 0 };
  return { key: 'starter', title: 'START', min: 0, permanentDiscountPercent: 0, extraCherriesPerOrder: 0 };
}

export function getNextTier(cherries) {
  const c = Math.max(0, Math.round(Number(cherries || 0)));
  if (c < 10) return { key: 'silver', title: 'SILVER', min: 10 };
  if (c < 25) return { key: 'gold', title: 'GOLD', min: 25 };
  if (c < 50) return { key: 'platinum', title: 'PLATINUM', min: 50 };
  if (c < 100) return { key: 'legend', title: 'LEGEND', min: 100 };
  return null;
}

export function getCherryProfile({ cherries, freeLiquids, freeBoxes }) {
  const c = Math.max(0, Math.round(Number(cherries || 0)));
  const tier = getCherryTier(c);
  const next = getNextTier(c);
  const target = next ? next.min : tier.min || 1;
  const pct = next ? Math.min(100, Math.max(0, Math.round((c / target) * 100))) : 100;
  return {
    cherries: c,
    tier,
    next,
    progress: { current: c, target, percent: pct },
    perOrderCherries: 1 + Number(tier.extraCherriesPerOrder || 0),
    freeLiquids: Math.max(0, Math.round(Number(freeLiquids || 0))),
    freeBoxes: Math.max(0, Math.round(Number(freeBoxes || 0))),
  };
}

export function cherryMilestoneRewards() {
  return [
    { at: 1, type: 'next_discount_fixed', value: 2 },
    { at: 2, type: 'next_discount_percent', value: 10 },
    { at: 3, type: 'next_discount_percent', value: 15 },
    { at: 4, type: 'next_discount_percent', value: 15, extraCherries: 2 },
    { at: 5, type: 'next_discount_percent', value: 20 },
    { at: 6, type: 'next_discount_percent', value: 20, extraCherries: 2 },
    { at: 7, type: 'free_liquid', value: 1 },
    { at: 8, type: 'next_discount_percent', value: 25 },
    { at: 9, type: 'next_discount_percent', value: 25, extraCherries: 2 },
    { at: 10, type: 'next_discount_percent', value: 25, freeLiquid: 1, tier: 'silver', freeBox: 1 },
    { at: 25, tier: 'gold', freeLiquid: 3, extraPerOrder: 1, freeBox: 1 },
    { at: 50, tier: 'platinum', freeLiquid: 5, extraPerOrder: 2, freeBox: 3 },
    { at: 100, tier: 'legend', freeLiquid: 10, extraPerOrder: 3, freeBox: 5 },
  ];
}
