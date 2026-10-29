"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AuthActionState {
  message: string;
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  next: z.string().optional(),
});

const passwordSchema = z
  .object({
    confirmPassword: z.string(),
    password: z.string().min(12).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
  });

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    next: formData.get("next"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { message: "กรุณาตรวจสอบอีเมลและรหัสผ่าน" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

  const next = parsed.data.next;
  redirect(next?.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function setPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordSchema.safeParse({
    confirmPassword: formData.get("confirmPassword"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      message:
        parsed.error.issues[0]?.message ??
        "รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษร",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { message: "ลิงก์หมดอายุ กรุณาขอคำเชิญใหม่" };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { message: "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่" };

  redirect("/admin");
}
