// Demand pool rules for the public overview. Pure functions only.
// Pilot values come from docs/community-based-negotiation-discovery.md and are not final policy.

// Pools with fewer members are hidden so a single household cannot be identified from totals.
export const MIN_POOL_MEMBERS = 3;

// Pilot tender threshold: 20 qualified households or about 100 kWp.
export const PILOT_TENDER_HOUSEHOLDS = 20;
export const PILOT_TENDER_KWP = 100;

export interface DemandPoolTotals {
  estimatedKwp: number;
  qualifiedHouseholdCount: number;
}

export function poolReadiness(pool: DemandPoolTotals) {
  const progress = Math.max(
    pool.qualifiedHouseholdCount / PILOT_TENDER_HOUSEHOLDS,
    pool.estimatedKwp / PILOT_TENDER_KWP,
  );
  const percent = Math.min(100, Math.round(progress * 100));
  return { percent, ready: percent >= 100 };
}
