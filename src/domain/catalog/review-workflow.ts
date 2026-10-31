// Pure rules for the Datasheet review workflow. No database, HTTP, or clock access.

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
  publish: ["reviewer", "super_admin"],
  recall: ["super_admin"],
  reject: ["reviewer", "super_admin"],
  verify: ["reviewer", "super_admin"],
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
  "pmaxWp",
  "vocV",
  "vmpV",
  "iscA",
  "impA",
  "maxSystemVoltageV",
] as const;

export const inverterCriticalFields = [
  "ratedAcKw",
  "maxDcVoltageV",
  "mpptRange",
  "mpptCurrent",
] as const;

export function criticalFieldsFor(category: "inverter" | "pv_module") {
  return category === "pv_module" ? pvCriticalFields : inverterCriticalFields;
}

export interface FourEyesResult {
  allowed: boolean;
  // True when the actor entered the spec themselves and may only proceed as Super Admin
  // with a recorded reason.
  overrideRequired: boolean;
}

// The person who entered the spec should not also verify it. A Super Admin may override
// with a mandatory reason so a small team is never permanently blocked; the override is
// recorded in verification_event.
export function evaluateFourEyes(input: {
  actorId: string;
  isSuperAdmin: boolean;
  overrideReason?: string | null;
  specEnteredBy: string | null;
}): FourEyesResult {
  if (!input.specEnteredBy || input.specEnteredBy !== input.actorId) {
    return { allowed: true, overrideRequired: false };
  }
  const hasReason = Boolean(input.overrideReason && input.overrideReason.trim().length >= 10);
  return {
    allowed: input.isSuperAdmin && hasReason,
    overrideRequired: true,
  };
}

export interface GateResult {
  blockers: string[];
  ready: boolean;
}

export function missingSourcePages(
  category: "inverter" | "pv_module",
  pages: Readonly<Record<string, string | undefined>>,
) {
  return criticalFieldsFor(category).filter((field) => !pages[field]?.trim());
}

// Gate for moving extracted_unverified -> verified. The reviewer must tick every critical
// field against the datasheet and every critical field must cite a source page.
export function evaluateVerifyGates(input: {
  category: "inverter" | "pv_module";
  confirmedFields: readonly string[];
  sourcePages: Readonly<Record<string, string | undefined>>;
  state: RevisionState;
}): GateResult {
  const blockers: string[] = [];

  if (input.state !== "extracted_unverified") {
    blockers.push("Revision ต้องมีสเปกที่รอตรวจสอบ");
  }
  const noPage = missingSourcePages(input.category, input.sourcePages);
  if (noPage.length > 0) {
    blockers.push(`ยังไม่ระบุหน้าอ้างอิงของ: ${noPage.join(", ")}`);
  }
  const unconfirmed = criticalFieldsFor(input.category).filter(
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
