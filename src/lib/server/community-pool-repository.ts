import "server-only";
import { MIN_POOL_MEMBERS, type DemandPoolTotals } from "@/domain/community/pools";
import { getDb } from "./db";

export interface DemandPoolSummary extends DemandPoolTotals {
  interestedCount: number;
  province: string;
}

// Aggregate only. Selects province and counts; never district, subdistrict, coordinates,
// names, email, or phone. Qualified = decision maker, installation window set, size known.
export async function listDemandPools(): Promise<DemandPoolSummary[]> {
  const sql = getDb();
  const qualifiedFilter = sql`
    buyer_interest.decision_role IN ('owner', 'authorized')
    AND buyer_interest.installation_window <> 'exploring'
    AND buyer_interest.selected_system_size_kw IS NOT NULL
  `;

  return sql<DemandPoolSummary[]>`
    SELECT
      interest_location_private.province AS province,
      COUNT(*)::int AS "interestedCount",
      COUNT(*) FILTER (WHERE ${qualifiedFilter})::int AS "qualifiedHouseholdCount",
      COALESCE(SUM(buyer_interest.selected_system_size_kw) FILTER (WHERE ${qualifiedFilter}), 0)::float8 AS "estimatedKwp"
    FROM buyer_interest
    JOIN interest_location_private
      ON interest_location_private.buyer_interest_id = buyer_interest.id
    WHERE buyer_interest.status IN ('pending', 'active')
      AND EXISTS (
        SELECT 1
        FROM community_consent_record
        WHERE community_consent_record.buyer_interest_id = buyer_interest.id
          AND community_consent_record.purpose = 'demand_matching'
          AND community_consent_record.granted
      )
    GROUP BY interest_location_private.province
    HAVING COUNT(*) >= ${MIN_POOL_MEMBERS}
    ORDER BY COUNT(*) DESC, interest_location_private.province
  `;
}
