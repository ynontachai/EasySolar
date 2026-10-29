"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import {
  loginAction,
  type AuthActionState,
} from "@/app/admin/actions";

const initialState: AuthActionState = { message: "" };

export function AdminLoginForm({
  authConfigured,
  nextPath,
}: {
  authConfigured: boolean;
  nextPath?: string;
}) {
  const [state, action, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="admin-auth-form">
      <input name="next" type="hidden" value={nextPath ?? ""} />
      <label>
        <span>อีเมล</span>
        <input
          autoComplete="email"
          inputMode="email"
          name="email"
          placeholder="name@company.com"
          required
          disabled={!authConfigured}
          type="email"
        />
      </label>
      <label>
        <span>รหัสผ่าน</span>
        <input
          autoComplete="current-password"
          minLength={8}
          name="password"
          required
          disabled={!authConfigured}
          type="password"
        />
      </label>
      {!authConfigured ? (
        <p className="admin-auth-error" role="status">
          ยังไม่ได้ตั้งค่า Supabase Auth สำหรับ environment นี้
        </p>
      ) : state.message ? (
        <p className="admin-auth-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className="button button--sun"
        disabled={isPending || !authConfigured}
        type="submit"
      >
        {isPending ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={18} />}
        {isPending ? "กำลังตรวจสอบ" : "เข้าสู่ระบบ"}
        {!isPending ? <ArrowRight size={18} /> : null}
      </button>
    </form>
  );
}
