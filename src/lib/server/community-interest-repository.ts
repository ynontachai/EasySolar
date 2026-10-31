import "server-only";
import type { CommunityInterestInput } from "@/domain/community/schema";
import { getDb } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http-error";

function createReferenceCode() {
  return `CBN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
export async function createCommunityInterest(input: CommunityInterestInput) {
  const sql = getDb();

  try {
    return await sql.begin(async (transaction) => {
      const referenceCode = createReferenceCode();
      const [interest] = await transaction<Array<{ id: string }>>`
        INSERT INTO buyer_interest (
          reference_code,
          property_type,
          decision_role,
          installation_window,
          preferred_radius_km,
          selected_system_size_kw,
          package_price_thb,
          investment_score,
          source
        ) VALUES (
          ${referenceCode},
          ${input.propertyType},
          ${input.decisionRole},
          ${input.installationWindow},
          ${input.preferredRadiusKm},
          ${input.selectedSystemSizeKw},
          ${input.packagePriceThb},
          ${input.investmentScore},
          'solar_value_result'
        )
        RETURNING id::text AS id
      `;
      if (!interest) throw new Error("COMMUNITY_INTEREST_INSERT_FAILED");

      await transaction`
        INSERT INTO interest_location_private (
          buyer_interest_id,
          province,
          district,
          subdistrict,
          postal_code,
          latitude,
          longitude
        ) VALUES (
          ${interest.id},
          ${input.province},
          ${input.district},
          ${input.subdistrict},
          ${input.postalCode},
          ${input.latitude},
          ${input.longitude}
        )
      `;

      await transaction`
        INSERT INTO interest_contact_private (
          buyer_interest_id,
          full_name,
          email,
          phone
        ) VALUES (
          ${interest.id},
          ${input.fullName},
          ${input.email},
          ${input.phone}
        )
      `;

      await transaction`
        INSERT INTO community_consent_record (
          buyer_interest_id,
          purpose,
          consent_version,
          granted
        ) VALUES
          (${interest.id}, 'demand_matching', '2026-10-30.v1', true),
          (${interest.id}, 'notifications', '2026-10-30.v1', ${input.consentNotifications === "on"})
      `;

      await transaction`
        INSERT INTO community_interest_event (buyer_interest_id, event_type, event_data)
        VALUES (
          ${interest.id},
          'interest.registered',
          ${transaction.json({ source: "public_registration" })}
        )
      `;

      return { referenceCode };
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new HttpError(
        409,
        "COMMUNITY_INTEREST_EXISTS",
        "อีเมลนี้ลงทะเบียนความสนใจไว้แล้ว ทีมงานจะใช้รายการเดิมเพื่อติดต่อกลับ",
      );
    }
    throw error;
  }
}
