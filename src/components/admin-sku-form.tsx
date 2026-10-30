"use client";

import { useActionState, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  PackagePlus,
  Plus,
} from "lucide-react";
import {
  createSkuAction,
  type CreateSkuActionState,
} from "@/app/admin/(protected)/catalog/actions";
import type {
  CatalogManufacturerOption,
  CatalogOrganizationOption,
  CatalogProductOption,
} from "@/lib/server/catalog-admin-repository";

const initialState: CreateSkuActionState = { message: "", status: "idle" };
type Category = "pv_module" | "inverter";
type EntryMode = "existing" | "new";

const categoryLabels: Record<Category, string> = {
  inverter: "Inverter",
  pv_module: "PV Module",
};

function getInitialIdentity(
  manufacturers: CatalogManufacturerOption[],
  products: CatalogProductOption[],
) {
  const category: Category = "pv_module";
  const manufacturerId = manufacturers[0]?.id ?? "";
  const hasModels = products.some(
    (product) =>
      product.category === category && product.manufacturerId === manufacturerId,
  );

  return {
    category,
    manufacturerId,
    manufacturerMode: manufacturers.length ? ("existing" as const) : ("new" as const),
    productMode: hasModels ? ("existing" as const) : ("new" as const),
  };
}

export function AdminSkuForm({
  manufacturers,
  organizations,
  products,
}: {
  manufacturers: CatalogManufacturerOption[];
  organizations: CatalogOrganizationOption[];
  products: CatalogProductOption[];
}) {
  const initialIdentity = getInitialIdentity(manufacturers, products);
  const [state, action, isPending] = useActionState(createSkuAction, initialState);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [category, setCategory] = useState<Category>(initialIdentity.category);
  const [manufacturerMode, setManufacturerMode] = useState<EntryMode>(
    initialIdentity.manufacturerMode,
  );
  const [manufacturerId, setManufacturerId] = useState(initialIdentity.manufacturerId);
  const [manufacturerName, setManufacturerName] = useState("");
  const [productMode, setProductMode] = useState<EntryMode>(initialIdentity.productMode);
  const [productModelId, setProductModelId] = useState("");
  const [exactModel, setExactModel] = useState("");
  const [sku, setSku] = useState("");
  const [variantLabel, setVariantLabel] = useState("");

  const availableModels = useMemo(
    () =>
      products.filter(
        (product) =>
          product.category === category && product.manufacturerId === manufacturerId,
      ),
    [category, manufacturerId, products],
  );

  const selectedManufacturer = manufacturers.find(
    (manufacturer) => manufacturer.id === manufacturerId,
  );
  const selectedProduct = products.find((product) => product.id === productModelId);
  const displayedBrand =
    manufacturerMode === "new"
      ? manufacturerName.trim()
      : selectedManufacturer?.name ?? "";
  const displayedModel =
    productMode === "new" ? exactModel.trim() : selectedProduct?.exactModel ?? "";
  const identityReady = Boolean(displayedBrand && displayedModel);
  const canSubmit = Boolean(
    organizations.length && identityReady && sku.trim() && variantLabel.trim(),
  );

  function chooseCategory(nextCategory: Category) {
    setCategory(nextCategory);
    setProductModelId("");
    if (manufacturerMode === "existing") {
      const hasModels = products.some(
        (product) =>
          product.category === nextCategory &&
          product.manufacturerId === manufacturerId,
      );
      setProductMode(hasModels ? "existing" : "new");
    }
  }

  function chooseManufacturer(nextManufacturerId: string) {
    setManufacturerId(nextManufacturerId);
    setProductModelId("");
    const hasModels = products.some(
      (product) =>
        product.category === category &&
        product.manufacturerId === nextManufacturerId,
    );
    setProductMode(hasModels ? "existing" : "new");
  }

  return (
    <form action={action} className="admin-product-builder">
      <header className="admin-product-builder__head">
        <div>
          <p className="eyebrow eyebrow--dark">ADD PRODUCT</p>
          <h2>เพิ่มสินค้าและ SKU</h2>
          <p>ค้นข้อมูลเดิมก่อน หากยังไม่มีสามารถสร้าง Brand และ Model ใหม่ได้ในหน้านี้</p>
        </div>
        <span><PackagePlus size={17} /> รายการเดียว</span>
      </header>

      {organizations.length === 0 ? (
        <div className="admin-form-blocker" role="status">
          บัญชีนี้ยังไม่มี Organization scope จึงยังสร้าง SKU ไม่ได้
        </div>
      ) : null}

      <div className="admin-product-builder__layout">
        <div className="admin-product-builder__fields">
          <fieldset className="admin-product-section">
            <legend>
              <span>01</span>
              <div>
                <strong>Product identity</strong>
                <small>เลือกประเภท Brand และ Model เพื่อป้องกันสินค้าซ้ำ</small>
              </div>
            </legend>

            <div className="admin-product-field">
              <label htmlFor="organizationId">เจ้าของรายการ / Organization</label>
              <select
                id="organizationId"
                name="organizationId"
                onChange={(event) => setOrganizationId(event.target.value)}
                required
                value={organizationId}
              >
                <option disabled value="">เลือก Organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <small>SKU จะอยู่ภายใต้สิทธิ์และ audit scope ของ Organization นี้</small>
            </div>

            <div className="admin-category-options">
              {(Object.keys(categoryLabels) as Category[]).map((value) => (
                <label data-selected={category === value} key={value}>
                  <input
                    checked={category === value}
                    name="category"
                    onChange={() => chooseCategory(value)}
                    type="radio"
                    value={value}
                  />
                  <span aria-hidden="true"><Check size={15} /></span>
                  <strong>{categoryLabels[value]}</strong>
                </label>
              ))}
            </div>

            <div className="admin-product-field">
              <div className="admin-product-field__label">
                <label htmlFor="manufacturerId">Brand / ผู้ผลิต</label>
                <button
                  onClick={() => {
                    const nextMode = manufacturerMode === "existing" ? "new" : "existing";
                    setManufacturerMode(nextMode);
                    setProductMode(nextMode === "new" ? "new" : initialIdentity.productMode);
                    setProductModelId("");
                  }}
                  type="button"
                >
                  <Plus size={14} />
                  {manufacturerMode === "existing" ? "เพิ่ม Brand ใหม่" : "เลือก Brand ที่มีอยู่"}
                </button>
              </div>
              {manufacturerMode === "existing" ? (
                <select
                  id="manufacturerId"
                  name="manufacturerId"
                  onChange={(event) => chooseManufacturer(event.target.value)}
                  required
                  value={manufacturerId}
                >
                  <option disabled value="">เลือก Brand</option>
                  {manufacturers.map((manufacturer) => (
                    <option key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  autoComplete="organization"
                  id="manufacturerId"
                  maxLength={160}
                  name="manufacturerName"
                  onChange={(event) => setManufacturerName(event.target.value)}
                  placeholder="เช่น LONGi Solar"
                  required
                  value={manufacturerName}
                />
              )}
              <small>ระบบตรวจชื่อ Brand เดิมแบบไม่แยกตัวพิมพ์เล็ก–ใหญ่</small>
            </div>

            <div className="admin-product-field">
              <div className="admin-product-field__label">
                <label htmlFor="productModelId">Model</label>
                {manufacturerMode === "existing" && availableModels.length > 0 ? (
                  <button
                    onClick={() => {
                      setProductMode(productMode === "existing" ? "new" : "existing");
                      setProductModelId("");
                    }}
                    type="button"
                  >
                    <Plus size={14} />
                    {productMode === "existing" ? "เพิ่ม Model ใหม่" : "เลือก Model ที่มีอยู่"}
                  </button>
                ) : null}
              </div>
              {productMode === "existing" && manufacturerMode === "existing" ? (
                <select
                  id="productModelId"
                  name="productModelId"
                  onChange={(event) => setProductModelId(event.target.value)}
                  required
                  value={productModelId}
                >
                  <option disabled value="">เลือก Model</option>
                  {availableModels.map((product) => (
                    <option key={product.id} value={product.id}>{product.exactModel}</option>
                  ))}
                </select>
              ) : (
                <input
                  id="productModelId"
                  maxLength={160}
                  name="exactModel"
                  onChange={(event) => setExactModel(event.target.value)}
                  placeholder="กรอกชื่อรุ่นตาม Datasheet ให้ตรงทุกตัวอักษร"
                  required
                  value={exactModel}
                />
              )}
              {productMode === "new" && manufacturerMode === "existing" && availableModels.length === 0 ? (
                <small>Brand นี้ยังไม่มี {categoryLabels[category]} — กรอก Model แรกได้เลย</small>
              ) : (
                <small>Model เป็นข้อมูลกลางที่ SKU และ Datasheet จะใช้อ้างอิงร่วมกัน</small>
              )}
            </div>
          </fieldset>

          <fieldset className="admin-product-section">
            <legend>
              <span>02</span>
              <div>
                <strong>Sellable variant</strong>
                <small>กำหนดรหัสที่ทีมขายและระบบ inventory จะใช้อ้างอิง</small>
              </div>
            </legend>

            <div className="admin-product-fields-grid">
              <div className="admin-product-field">
                <label htmlFor="sku">SKU</label>
                <input
                  autoCapitalize="characters"
                  id="sku"
                  maxLength={80}
                  name="sku"
                  onChange={(event) => setSku(event.target.value.toUpperCase())}
                  placeholder="เช่น PV-LR5-550-TH"
                  required
                  value={sku}
                />
                <small>ต้องไม่ซ้ำกันทั้งระบบ; ใช้ A–Z, 0–9, จุด, ขีด และ /</small>
              </div>
              <div className="admin-product-field">
                <label htmlFor="variantLabel">ชื่อรุ่นย่อย</label>
                <input
                  id="variantLabel"
                  maxLength={160}
                  name="variantLabel"
                  onChange={(event) => setVariantLabel(event.target.value)}
                  placeholder="เช่น 550 W · Black frame"
                  required
                  value={variantLabel}
                />
                <small>อธิบายสิ่งที่ทำให้ SKU นี้ต่างจาก variant อื่น</small>
              </div>
            </div>

            <div className="admin-product-field">
              <label htmlFor="manufacturerPartNumber">Manufacturer part number</label>
              <input
                id="manufacturerPartNumber"
                maxLength={120}
                name="manufacturerPartNumber"
                placeholder="ถ้ามี — รหัสจากผู้ผลิต"
              />
              <small>ไม่บังคับ และแยกจาก SKU ภายใน EasySolar</small>
            </div>
          </fieldset>
        </div>

        <aside className="admin-product-summary" aria-label="สรุปสินค้าที่กำลังสร้าง">
          <div className="admin-product-summary__top">
            <span>LIVE SUMMARY</span>
            <strong>{displayedModel || "สินค้าใหม่"}</strong>
            <p>{displayedBrand || "เลือก Brand เพื่อเริ่มต้น"}</p>
          </div>
          <dl>
            <div><dt>ประเภท</dt><dd>{categoryLabels[category]}</dd></div>
            <div><dt>Brand</dt><dd>{displayedBrand || "ยังไม่ระบุ"}</dd></div>
            <div><dt>Model</dt><dd>{displayedModel || "ยังไม่ระบุ"}</dd></div>
            <div><dt>SKU</dt><dd>{sku || "ยังไม่ระบุ"}</dd></div>
            <div>
              <dt>Organization</dt>
              <dd>{organizations.find((item) => item.id === organizationId)?.name ?? "ยังไม่พบ"}</dd>
            </div>
          </dl>
          <div className="admin-product-summary__readiness" data-ready={identityReady}>
            {identityReady ? <CheckCircle2 size={17} /> : <ChevronRight size={17} />}
            <div>
              <strong>{identityReady ? "Identity พร้อม" : "กรอก Identity ให้ครบ"}</strong>
              <span>Datasheet และ Engineering Spec เพิ่มต่อได้หลังสร้างรายการ</span>
            </div>
          </div>
        </aside>
      </div>

      <footer className="admin-product-builder__actions">
        <p data-status={state.status} role={state.status === "error" ? "alert" : "status"}>
          {state.status === "success" ? <CheckCircle2 size={17} /> : null}
          {state.message || "ระบบจะสร้าง Product identity และ SKU พร้อม Audit event"}
        </p>
        <button className="button button--sun" disabled={!canSubmit || isPending} type="submit">
          {isPending ? <LoaderCircle className="spin" size={17} /> : <PackagePlus size={17} />}
          {isPending ? "กำลังบันทึก" : "บันทึกสินค้าและ SKU"}
        </button>
      </footer>
    </form>
  );
}
