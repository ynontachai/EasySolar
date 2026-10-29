"use client";

import { useActionState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import {
  setPasswordAction,
  type AuthActionState,
} from "@/app/admin/actions";

const initialState: AuthActionState = { message: "" };

export function AdminSetPasswordForm() {
  const [state, action, isPending] = useActionState(
    setPasswordAction,
    initialState,
  );

  return (
    <form action={action} className="admin-auth-form">
      <label>
        <span>รหัสผ่านใหม่</span>
        <input
          autoComplete="new-password"
          minLength={12}
          name="password"
          required
          type="password"
        />
        <small>อย่างน้อย 12 ตัวอักษร</small>
      </label>
      <label>
        <span>ยืนยันรหัสผ่าน</span>
        <input
          autoComplete="new-password"
          minLength={12}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {state.message ? (
        <p className="admin-auth-error" role="alert">
          {state.message}
        </p>
      ) : null}
      <button className="button button--sun" disabled={isPending} type="submit">
        {isPending ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
        {isPending ? "กำลังบันทึก" : "ตั้งรหัสผ่านและไปต่อ"}
      </button>
    </form>
  );
}
