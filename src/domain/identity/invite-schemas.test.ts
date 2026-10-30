import { describe, expect, it } from "vitest";
import { inviteAdminSchema } from "./invite-schemas";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("admin invite schema", () => {
  it("normalizes email and blank display name", () => {
    const parsed = inviteAdminSchema.parse({
      displayName: "   ",
      email: "  Ops.User@Example.com ",
      organizationId,
      role: "account_admin",
    });

    expect(parsed.email).toBe("ops.user@example.com");
    expect(parsed.displayName).toBeNull();
  });

  it("rejects super_admin because platform roles are not invitable here", () => {
    const result = inviteAdminSchema.safeParse({
      email: "boss@example.com",
      organizationId,
      role: "super_admin",
    });

    expect(result.success).toBe(false);
  });

  it("requires an organization uuid", () => {
    const result = inviteAdminSchema.safeParse({
      email: "reviewer@example.com",
      organizationId: "not-a-uuid",
      role: "reviewer",
    });

    expect(result.success).toBe(false);
  });
});
