"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, LoaderCircle, MailPlus } from "lucide-react";
import {
  inviteAdminAction,
  type InviteAdminActionState,
} from "@/app/admin/(protected)/users/actions";
import type { CatalogOrganizationOption } from "@/lib/server/catalog-admin-repository";

const initialState: InviteAdminActionState = { message: "", status: "idle" };

export function AdminInviteForm({
  organizations,
}: {
  organizations: CatalogOrganizationOption[];
}) {
  const [state, action, isPending] = useActionState(inviteAdminAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

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
        <label>
          <span>บทบาท</span>
          <select defaultValue="account_admin" name="role" required>
            <option value="account_admin">Account Admin</option>
            <option value="reviewer">Catalog Reviewer</option>
          </select>
        </label>
        <label className="admin-invite-form__wide">
          <span>Organization</span>
          <select defaultValue={organizations[0]?.id} name="organizationId" required>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
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
