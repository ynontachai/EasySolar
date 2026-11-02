import "server-only";
import type { CommunityInterestInput } from "@/domain/community/schema";
import { getDb } from "@/lib/server/db";
import { HttpError } from "@/lib/server/http-error";

function createReferenceCode() {
  return `CBN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function createReferralCode() {
  return `ES-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

export async function createCommunityInterest(input: CommunityInterestInput) {
  const sql = getDb();

  try {
    return await sql.begin(async (transaction) => {
      const referenceCode = createReferenceCode();
      const referralCode = createReferralCode();
      const [referrer] = input.referralCode
        ? await transaction<Array<{ id: string }>>`
            SELECT id::text AS id
            FROM community_member
            WHERE referral_code = ${input.referralCode}
          `
        : [];

      if (input.referralCode && !referrer) {
        throw new HttpError(
          422,
          "COMMUNITY_REFERRAL_NOT_FOUND",
          "ไม่พบ Referral code นี้ กรุณาตรวจสอบอีกครั้งหรือลบ Code เพื่อสมัครต่อ",
        );
      }

      const [member] = await transaction<Array<{ id: string }>>`
        INSERT INTO community_member (referral_code, referred_by_member_id)
        VALUES (${referralCode}, ${referrer?.id ?? null})
        RETURNING id::text AS id
      `;
      if (!member) throw new Error("COMMUNITY_MEMBER_INSERT_FAILED");

      await transaction`
        INSERT INTO community_member_contact_private (
          member_id,
          full_name,
          email,
          phone
        ) VALUES (
          ${member.id},
          ${input.fullName},
          ${input.email},
          ${input.phone}
        )
      `;

      const [interest] = await transaction<Array<{ id: string }>>`
        INSERT INTO buyer_interest (
          member_id,
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
          ${member.id},
          ${referenceCode},
          ${input.propertyType},
          ${input.decisionRole},
          ${input.installationWindow},
          ${input.preferredRadiusKm},
          ${input.selectedSystemSizeKw},
          ${input.packagePriceThb},
          ${input.investmentScore},
          ${input.packagePriceThb !== null || input.investmentScore !== null
            ? "solar_value_result"
            : "community_buy"}
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
          ${transaction.json({
            memberId: member.id,
            referredByMemberId: referrer?.id ?? null,
            source: "public_registration",
          })}
        )
      `;

      return { memberId: member.id, referenceCode, referralCode };
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
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
