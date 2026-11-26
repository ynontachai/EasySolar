// Pure rules for the Datasheet review workflow. No database, HTTP, or clock access.

import type { AssetState } from "@/domain/assets/config";

export type RevisionState =
  | "draft"
  | "extracted_unverified"
  | "verified"
  | "published"
  | "superseded"
  | "recalled";

export type RevisionAction = "enter_spec" | "verify" | "reject" | "publish" | "recall";

export type ReviewRole = "account_admin" | "reviewer" | "super_admin";

// Which role may perform which action. Scope (organization) is checked separately.
const actionRoles: Record<RevisionAction, readonly ReviewRole[]> = {
  enter_spec: ["account_admin", "super_admin"],
  publish: ["account_admin", "reviewer", "super_admin"],
  recall: ["account_admin", "super_admin"],
  reject: ["account_admin", "reviewer", "super_admin"],
  verify: ["account_admin", "reviewer", "super_admin"],
};

const actionFromStates: Record<RevisionAction, readonly RevisionState[]> = {
  enter_spec: ["draft", "extracted_unverified"],
  publish: ["verified"],
  recall: ["published"],
  reject: ["extracted_unverified", "verified"],
  verify: ["extracted_unverified"],
};

export function rolesAllowedFor(action: RevisionAction) {
  return actionRoles[action];
}

export function canPerform(
  action: RevisionAction,
  state: RevisionState,
  roles: readonly ReviewRole[],
) {
  return (
    actionFromStates[action].includes(state) &&
    roles.some((role) => actionRoles[action].includes(role))
  );
}

export const pvCriticalFields = [
  "betaVocPercentPerC",
  "pmaxWp",
  "vocV",
  "vmpV",
  "iscA",
  "impA",
  "maxSystemVoltageV",
] as const;

export const inverterCriticalFields = [
  "phaseCount",
  "batteryVoltageClass",
  "ratedAcKw",
  "maxDcVoltageV",
  "mpptRange",
  "mpptOperatingCurrent",
  "mpptShortCircuitCurrent",
  "mpptTopology",
  "startupVoltageV",
] as const;

export interface ReviewRequirementContext {
  betaVmpSource?: "datasheet" | "derived" | null;
  hasMaxDcPower?: boolean;
  hasMaxRecommendedPv?: boolean;
  inverterType?: "string" | "hybrid" | "micro" | null;
}

export function reviewRequirementsFor(
  category: "inverter" | "pv_module",
  context: ReviewRequirementContext = {},
) {
  if (category === "pv_module") {
    const conditional =
      context.betaVmpSource === "datasheet"
        ? ["betaVmpPercentPerC"]
        : context.betaVmpSource === "derived"
          ? ["gammaPmaxPercentPerC", "alphaIscPercentPerC", "betaVmpDerivation"]
          : [];
    return {
      criticalFields: [...pvCriticalFields, ...conditional],
      sourceRequiredFields: [
        ...pvCriticalFields,
        ...conditional.filter((field) => field !== "betaVmpDerivation"),
      ],
    };
  }

  const powerFields = [
    context.hasMaxDcPower ? "maxDcPowerWp" : null,
    context.hasMaxRecommendedPv ? "maxRecommendedPvWp" : null,
  ].filter((field): field is string => field !== null);
  const identityFields = inverterCriticalFields.filter(
    (field) => field !== "batteryVoltageClass" || context.inverterType === "hybrid",
  );
  return {
    criticalFields: [...identityFields, ...powerFields],
    sourceRequiredFields: [...identityFields, ...powerFields],
  };
}

export function criticalFieldsFor(
  category: "inverter" | "pv_module",
  context: ReviewRequirementContext = {},
) {
  return reviewRequirementsFor(category, context).criticalFields;
}

export interface FourEyesResult {
  allowed: boolean;
  // True when the actor entered the spec themselves and may only proceed as Super Admin
  // with a recorded reason.
  overrideRequired: boolean;
}

// The person who entered the spec should not also verify it. A small team may still do so
// with a mandatory reason, so nobody is permanently blocked; the reason and a self-verified
// flag are recorded in verification_event.
export function evaluateFourEyes(input: {
  actorId: string;
  overrideReason?: string | null;
  specEnteredBy: string | null;
}): FourEyesResult {
  if (!input.specEnteredBy || input.specEnteredBy !== input.actorId) {
    return { allowed: true, overrideRequired: false };
  }
  const hasReason = Boolean(input.overrideReason && input.overrideReason.trim().length >= 10);
  return {
    allowed: hasReason,
    overrideRequired: true,
  };
}

export interface GateResult {
  blockers: string[];
  ready: boolean;
}

export interface AssetReviewStatus {
  label: string;
  publishReady: boolean;
  tone: "danger" | "neutral" | "success" | "warning";
}

export function assetReviewStatus(
  assetState: AssetState | null,
  hasSourceUrl: boolean,
): AssetReviewStatus {
  if (assetState === "available") {
    return { label: "Datasheet สแกนผ่านแล้ว", publishReady: true, tone: "success" };
  }
  if (assetState === "scanning") {
    return {
      label: "อัปโหลดแล้ว · กำลังรอ Malware scan",
      publishReady: hasSourceUrl,
      tone: "warning",
    };
  }
  if (assetState === "quarantined") {
    return {
      label: hasSourceUrl
        ? "ไฟล์แนบไม่ผ่าน Malware scan · ใช้ลิงก์แหล่งข้อมูลทางการแทน"
        : "ไฟล์ไม่ผ่าน Malware scan · Publish ไม่ได้",
      publishReady: hasSourceUrl,
      tone: "danger",
    };
  }
  if (assetState === "pending_upload" || assetState === "uploaded") {
    return {
      label: "การอัปโหลดหรือยืนยันไฟล์ยังไม่เสร็จ",
      publishReady: hasSourceUrl,
      tone: "warning",
    };
  }
  return {
    label: hasSourceUrl
      ? "ไม่มีไฟล์แนบ · ใช้ลิงก์แหล่งข้อมูลทางการ"
      : "ยังไม่มี Datasheet ที่พร้อมใช้งาน",
    publishReady: hasSourceUrl,
    tone: "neutral",
  };
}

export function missingSourcePages(
  category: "inverter" | "pv_module",
  pages: Readonly<Record<string, string | undefined>>,
  context: ReviewRequirementContext = {},
) {
  return reviewRequirementsFor(category, context).sourceRequiredFields.filter(
    (field) => !pages[field]?.trim(),
  );
}

// Gate for moving extracted_unverified -> verified. The reviewer must tick every critical
// field against the datasheet and every critical field must cite a source page.
export function evaluateVerifyGates(input: {
  category: "inverter" | "pv_module";
  confirmedFields: readonly string[];
  context?: ReviewRequirementContext;
  sourcePages: Readonly<Record<string, string | undefined>>;
  state: RevisionState;
}): GateResult {
  const blockers: string[] = [];

  if (input.state !== "extracted_unverified") {
    blockers.push("Revision ต้องมีสเปกที่รอตรวจสอบ");
  }
  const requirements = reviewRequirementsFor(input.category, input.context);
  const noPage = missingSourcePages(input.category, input.sourcePages, input.context);
  if (noPage.length > 0) {
    blockers.push(`ยังไม่ระบุหน้าอ้างอิงของ: ${noPage.join(", ")}`);
  }
  const unconfirmed = requirements.criticalFields.filter(
    (field) => !input.confirmedFields.includes(field),
  );
  if (unconfirmed.length > 0) {
    blockers.push(`ยังไม่ได้ยืนยันค่า: ${unconfirmed.join(", ")}`);
  }

  return { blockers, ready: blockers.length === 0 };
}

// Gate for moving verified -> published. Optional completeness never blocks publish.
export function evaluatePublishGates(input: {
  hasAvailableFile: boolean;
  hasSourceUrl: boolean;
  state: RevisionState;
}): GateResult {
  const blockers: string[] = [];

  if (input.state !== "verified") {
    blockers.push("Revision ต้องผ่านการตรวจสอบสเปกก่อน");
  }
  if (!input.hasAvailableFile && !input.hasSourceUrl) {
    blockers.push("ต้องมี Datasheet ที่ผ่านการสแกนแล้ว หรือลิงก์แหล่งข้อมูลทางการ");
  }

  return { blockers, ready: blockers.length === 0 };
}

export const revisionStateLabels: Record<RevisionState, string> = {
  draft: "DRAFT · รอกรอกสเปก",
  extracted_unverified: "รอตรวจสอบสเปก",
  published: "PUBLISHED",
  recalled: "RECALLED",
  superseded: "SUPERSEDED",
  verified: "ตรวจแล้ว · รอ Publish",
};
