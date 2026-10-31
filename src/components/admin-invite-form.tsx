"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MailPlus } from "lucide-react";
import {
  inviteAdminAction,
  type InviteAdminActionState,
} from "@/app/admin/(protected)/users/actions";
import type { CatalogOrganizationOption } from "@/lib/server/catalog-admin-repository";
import { ThemeSelect } from "@/components/theme-select";

const initialState: InviteAdminActionState = { message: "", status: "idle" };

export function AdminInviteForm({
  organizations,
}: {
  organizations: CatalogOrganizationOption[];
}) {
  const [state, action, isPending] = useActionState(inviteAdminAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("account_admin");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  const isReady = organizations.length > 0;

  return (
    <form action={action} className="admin-invite-form" ref={formRef}>
      <div className="admin-invite-form__head">
        <div>
          <p className="eyebrow eyebrow--dark">INVITE ONLY</p>
          <h2>ส่งคำเชิญผู้ดูแล</h2>
          <p>ระบบส่งอีเมลคำเชิญให้ทันที ผู้รับต้องตั้งรหัสผ่านก่อนเข้าใช้งาน</p>
        </div>
        <span>SUPER ADMIN</span>
      </div>
      {!isReady ? (
        <div className="admin-form-blocker" role="status">
          ยังไม่มี Organization ที่ใช้งานได้ กรุณาเพิ่ม Organization ก่อนส่งคำเชิญ
        </div>
      ) : null}
      <div className="admin-invite-form__grid">
        <label className="admin-invite-form__wide">
          <span>อีเมล</span>
          <input
            autoComplete="off"
            autoCapitalize="none"
            inputMode="email"
            name="email"
            placeholder="name@company.com"
            required
            type="email"
          />
        </label>
        <label>
          <span>ชื่อที่แสดง</span>
          <input maxLength={120} name="displayName" placeholder="ไม่บังคับ" type="text" />
        </label>
        <div className="admin-invite-form__field">
          <span>บทบาท</span>
          <ThemeSelect name="role" onValueChange={setRole} options={[
            { label: "Account Admin", value: "account_admin" },
            { label: "Catalog Reviewer", value: "reviewer" },
          ]} required value={role} />
        </div>
        <div className="admin-invite-form__field admin-invite-form__wide">
          <span>Organization</span>
          <ThemeSelect disabled={!isReady} name="organizationId" onValueChange={setOrganizationId} options={
            organizations.map((organization) => ({ label: organization.name, value: organization.id }))
          } required searchable value={organizationId} />
        </div>
      </div>
      <div className="admin-invite-form__actions">
        <p data-status={state.status} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "success" ? <CheckCircle2 size={17} aria-hidden="true" /> : null}
          {state.message || "ผู้รับจะได้รับลิงก์ตั้งรหัสผ่านทางอีเมล"}
        </p>
        <button className="button button--sun" disabled={!isReady || isPending} type="submit">
          {isPending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <MailPlus size={17} aria-hidden="true" />}
          {isPending ? "กำลังส่งคำเชิญ" : "ส่งคำเชิญทางอีเมล"}
        </button>
      </div>
    </form>
  );
}
