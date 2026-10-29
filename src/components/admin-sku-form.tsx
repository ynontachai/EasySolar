"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import {
  createSkuAction,
  type CreateSkuActionState,
} from "@/app/admin/(protected)/catalog/actions";
import type {
  CatalogOrganizationOption,
  CatalogProductOption,
} from "@/lib/server/catalog-admin-repository";

const initialState: CreateSkuActionState = { message: "", status: "idle" };

export function AdminSkuForm({
  organizations,
  products,
}: {
  organizations: CatalogOrganizationOption[];
  products: CatalogProductOption[];
}) {
  const [state, action, isPending] = useActionState(createSkuAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  const isReady = organizations.length > 0 && products.length > 0;

  return (
    <form action={action} className="admin-sku-form" ref={formRef}>
      <div className="admin-sku-form__head">
        <div>
          <p className="eyebrow eyebrow--dark">CREATE DRAFT</p>
          <h2>เพิ่ม SKU</h2>
          <p>SKU เป็นรหัสขาย ส่วนข้อมูลวิศวกรรมอ้างจาก Product Model ที่เลือก</p>
        </div>
        <span>DRAFT ONLY</span>
      </div>
      {!isReady ? (
        <div className="admin-form-blocker" role="status">
          {!products.length
            ? "ยังไม่มี Product Model กรุณาเพิ่ม Datasheet ก่อนสร้าง SKU"
            : "บัญชีนี้ยังไม่มี Organization scope"}
        </div>
      ) : null}
      <div className="admin-sku-form__grid">
        <label>
          <span>Organization</span>
          <select defaultValue={organizations[0]?.id} name="organizationId" required>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>{organization.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Product Model</span>
          <select defaultValue="" name="productModelId" required>
            <option disabled value="">เลือกผู้ผลิตและรุ่น</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.manufacturer} · {product.exactModel} · {product.category === "pv_module" ? "PV" : "Inverter"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>SKU</span>
          <input autoCapitalize="characters" name="sku" placeholder="เช่น PV-LR5-550-TH" required />
          <small>ต้องไม่ซ้ำกันทั้งระบบ</small>
        </label>
        <label>
          <span>ชื่อรุ่นย่อย</span>
          <input name="variantLabel" placeholder="เช่น 550 W · Black frame" required />
        </label>
        <label className="admin-sku-form__wide">
          <span>Manufacturer part number</span>
          <input name="manufacturerPartNumber" placeholder="ไม่บังคับ" />
        </label>
      </div>
      <div className="admin-sku-form__actions">
        <p data-status={state.status} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "success" ? <CheckCircle2 size={17} /> : null}
          {state.message || "บันทึกเป็น Draft และสร้าง Audit event อัตโนมัติ"}
        </p>
        <button className="button button--sun" disabled={!isReady || isPending} type="submit">
          {isPending ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}
          {isPending ? "กำลังบันทึก" : "สร้าง SKU Draft"}
        </button>
      </div>
    </form>
  );
}
