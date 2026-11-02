import "server-only";
import type { AdminPrincipal } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http-error";

export const communityInterestStatuses = ["pending", "active", "withdrawn", "converted"] as const;
export type CommunityInterestStatus = (typeof communityInterestStatuses)[number];

export interface CommunityInterestListItem {
  createdAt: Date;
  district: string;
  email: string;
  fullName: string;
  id: string;
  memberId: string;
  phone: string | null;
  province: string;
  referralCode: string;
  referredByCode: string | null;
  selectedSystemSizeKw: number | null;
  status: CommunityInterestStatus;
}

export interface CommunityInterestDetail extends CommunityInterestListItem {
  decisionRole: string;
  installationWindow: string;
  investmentScore: number | null;
  latitude: number | null;
  longitude: number | null;
  packagePriceThb: number | null;
  postalCode: string;
  preferredRadiusKm: number;
  propertyType: string;
  referenceCode: string;
  referralCount: number;
  referredByMemberId: string | null;
  referredByName: string | null;
  source: string;
  subdistrict: string;
  updatedAt: Date;
}

function assertCanManageCommunity(principal: AdminPrincipal) {
  const allowed = principal.roles.some((role) => role.code === "super_admin");
  if (!allowed) {
    throw new HttpError(403, "COMMUNITY_ADMIN_REQUIRED", "บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลลูกค้า Community");
  }
}

export async function listCommunityInterests(
  principal: AdminPrincipal,
  filters: { query?: string; status?: CommunityInterestStatus },
) {
  assertCanManageCommunity(principal);
  const sql = getDb();
  const query = filters.query?.trim() ?? "";
  const status = filters.status ?? null;

  return sql<Array<CommunityInterestListItem>>`
    SELECT
      buyer_interest.id::text AS id,
      buyer_interest.member_id::text AS "memberId",
      buyer_interest.status::text AS status,
      buyer_interest.selected_system_size_kw::float8 AS "selectedSystemSizeKw",
      buyer_interest.created_at AS "createdAt",
      community_member.referral_code::text AS "referralCode",
      referrer.referral_code::text AS "referredByCode",
      member_contact.full_name AS "fullName",
      member_contact.email::text AS email,
      member_contact.phone,
      interest_location_private.province,
      interest_location_private.district
    FROM buyer_interest
    JOIN community_member ON community_member.id = buyer_interest.member_id
    JOIN community_member_contact_private AS member_contact
      ON member_contact.member_id = community_member.id
    JOIN interest_location_private
      ON interest_location_private.buyer_interest_id = buyer_interest.id
    LEFT JOIN community_member AS referrer
      ON referrer.id = community_member.referred_by_member_id
    WHERE (${status}::text IS NULL OR buyer_interest.status::text = ${status})
      AND (
        ${query} = ''
        OR member_contact.full_name ILIKE ${`%${query}%`}
        OR member_contact.email::text ILIKE ${`%${query}%`}
        OR coalesce(member_contact.phone, '') ILIKE ${`%${query}%`}
        OR community_member.referral_code::text ILIKE ${`%${query}%`}
        OR buyer_interest.reference_code::text ILIKE ${`%${query}%`}
      )
    ORDER BY buyer_interest.created_at DESC
    LIMIT 100
  `;
}

export async function getCommunityInterest(
  principal: AdminPrincipal,
  interestId: string,
) {
  assertCanManageCommunity(principal);
  const sql = getDb();
  const [row] = await sql<Array<CommunityInterestDetail>>`
    SELECT
      buyer_interest.id::text AS id,
      buyer_interest.member_id::text AS "memberId",
      buyer_interest.reference_code::text AS "referenceCode",
      buyer_interest.status::text AS status,
      buyer_interest.property_type::text AS "propertyType",
      buyer_interest.decision_role::text AS "decisionRole",
      buyer_interest.installation_window::text AS "installationWindow",
      buyer_interest.preferred_radius_km AS "preferredRadiusKm",
      buyer_interest.selected_system_size_kw::float8 AS "selectedSystemSizeKw",
      buyer_interest.package_price_thb AS "packagePriceThb",
      buyer_interest.investment_score AS "investmentScore",
      buyer_interest.source,
      buyer_interest.created_at AS "createdAt",
      buyer_interest.updated_at AS "updatedAt",
      community_member.referral_code::text AS "referralCode",
      community_member.referred_by_member_id::text AS "referredByMemberId",
      referrer.referral_code::text AS "referredByCode",
      referrer_contact.full_name AS "referredByName",
      member_contact.full_name AS "fullName",
      member_contact.email::text AS email,
      member_contact.phone,
      interest_location_private.province,
      interest_location_private.district,
      interest_location_private.subdistrict,
      interest_location_private.postal_code AS "postalCode",
      interest_location_private.latitude::float8 AS latitude,
      interest_location_private.longitude::float8 AS longitude,
      (
        SELECT count(*)::int
        FROM community_member AS referred_member
        WHERE referred_member.referred_by_member_id = community_member.id
      ) AS "referralCount"
    FROM buyer_interest
    JOIN community_member ON community_member.id = buyer_interest.member_id
    JOIN community_member_contact_private AS member_contact
      ON member_contact.member_id = community_member.id
    JOIN interest_location_private
      ON interest_location_private.buyer_interest_id = buyer_interest.id
    LEFT JOIN community_member AS referrer
      ON referrer.id = community_member.referred_by_member_id
    LEFT JOIN community_member_contact_private AS referrer_contact
      ON referrer_contact.member_id = referrer.id
    WHERE buyer_interest.id = ${interestId}
  `;
  return row ?? null;
}

export async function updateCommunityInterestStatus(input: {
  interestId: string;
  principal: AdminPrincipal;
  status: CommunityInterestStatus;
}) {
  assertCanManageCommunity(input.principal);
  const sql = getDb();

  return sql.begin(async (transaction) => {
    const [before] = await transaction<Array<{ status: CommunityInterestStatus }>>`
      SELECT status::text AS status
      FROM buyer_interest
      WHERE id = ${input.interestId}
      FOR UPDATE
    `;
    if (!before) throw new HttpError(404, "COMMUNITY_INTEREST_NOT_FOUND", "ไม่พบรายการ Community นี้");

    await transaction`
      UPDATE buyer_interest
      SET status = ${input.status}, updated_at = now()
      WHERE id = ${input.interestId}
    `;
    await transaction`
      INSERT INTO community_interest_event (buyer_interest_id, event_type, event_data)
      VALUES (
        ${input.interestId},
        'interest.status_changed',
        ${transaction.json({
          actorUserId: input.principal.userId,
          from: before.status,
          to: input.status,
        })}
      )
    `;
  });
}
