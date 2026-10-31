import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { RevisionSpecForm } from "@/components/revision-spec-form";
import {
  canPerform,
  revisionStateLabels,
  type ReviewRole,
} from "@/domain/catalog/review-workflow";
import { requireAdminPage } from "@/lib/server/admin-auth";
import { isDatabaseConfigured } from "@/lib/server/db";
import { getRevisionSpecTarget } from "@/lib/server/review-repository";

export const metadata: Metadata = { title: "Admin Enter Spec" };

export default async function AdminRevisionSpecPage({
  params,
}: {
  params: Promise<{ revisionId: string }>;
}) {
  await connection();
  const { revisionId } = await params;
  if (!z.string().uuid().safeParse(revisionId).success) notFound();

  const principal = await requireAdminPage();
  const target =
    isDatabaseConfigured() ? await getRevisionSpecTarget(revisionId) : null;
  if (!target) notFound();

  const roles = principal.roles.map((role) => role.code as ReviewRole);
  const canEnter = canPerform("enter_spec", target.state, roles);

  return (
    <main className="admin-page">
      <Link className="spec-back" href="/admin/equipment">
        <ArrowLeft size={16} aria-hidden="true" /> กลับไปคิวตรวจสอบ
      </Link>

      <div className="admin-bar">
        <div>
          <p className="eyebrow eyebrow--dark">CATALOG OPERATIONS</p>
          <h1>กรอกสเปก {target.exactModel}</h1>
          <p className="spec-back__meta">
            {target.manufacturer} · {target.revisionLabel}
          </p>
        </div>
        <span className="admin-status">{revisionStateLabels[target.state]}</span>
      </div>

      {canEnter ? (
        <RevisionSpecForm target={target} />
      ) : (
        <div className="admin-form-blocker" role="status">
          <ShieldAlert size={16} aria-hidden="true" /> revision นี้ไม่อยู่ในสถานะที่กรอกสเปกได้ หรือบัญชีนี้ไม่มีสิทธิ์กรอกสเปก
        </div>
      )}
    </main>
  );
}
