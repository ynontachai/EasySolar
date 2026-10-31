/* eslint-disable @next/next/no-img-element -- product images redirect to short-lived signed URLs that the image optimizer cannot follow */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  LoaderCircle,
  PackagePlus,
  ImagePlus,
  Plus,
  UploadCloud,
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
import { ThemeSelect } from "@/components/theme-select";
import { MAX_PRODUCT_IMAGE_SIZE_BYTES, PRODUCT_IMAGE_MEDIA_TYPES } from "@/domain/assets/config";

const initialState: CreateSkuActionState = { message: "", status: "idle" };
type Category = "pv_module" | "inverter";
type EntryMode = "existing" | "new";

const categoryLabels: Record<Category, string> = {
  inverter: "Inverter",
  pv_module: "PV Module",
};

type MediaPhase = "idle" | "uploading" | "success" | "error";

async function createFileChecksums(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const bytes = new Uint8Array(digest);
  return {
    base64: btoa(String.fromCharCode(...bytes)),
    hex: Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

async function readMediaResponse<T>(response: Response) {
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Media request failed (${response.status})`);
  return body;
}

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
  const router = useRouter();
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
  const [altText, setAltText] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaPhase, setMediaPhase] = useState<MediaPhase>("idle");
  const [mediaMessage, setMediaMessage] = useState("");
  const uploadedVariantRef = useRef("");
  const uploadedMediaIndexesRef = useRef(new Set<number>());

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
    organizations.length && identityReady && sku.trim() && variantLabel.trim() &&
    altText.trim().length >= 2 && mediaFiles.length > 0,
  );

  useEffect(() => {
    return () => mediaPreviews.forEach((preview) => URL.revokeObjectURL(preview));
  }, [mediaPreviews]);

  const uploadCreatedMedia = useCallback(async () => {
    if (!state.productVariantId || !state.productModelId || !state.organizationId) return;
    try {
      uploadedVariantRef.current = state.productVariantId;
      setMediaPhase("uploading");
      setMediaMessage(`กำลังอัปโหลดรูป ${uploadedMediaIndexesRef.current.size}/${mediaFiles.length}`);
      for (const [index, file] of mediaFiles.entries()) {
        if (uploadedMediaIndexesRef.current.has(index)) continue;
          const checksum = await createFileChecksums(file);
          const intentResponse = await fetch("/api/v1/admin/product-media/upload-intents", {
            body: JSON.stringify({
              altText,
              filename: file.name,
              mediaType: file.type,
              organizationId: state.organizationId,
              productModelId: state.productModelId,
              productVariantId: state.productVariantId,
              role: index === 0 ? "primary" : "gallery",
              sha256Base64: checksum.base64,
              sha256Hex: checksum.hex,
              sizeBytes: file.size,
              sortOrder: index,
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          });
          const intent = await readMediaResponse<{
            assetId: string;
            uploadHeaders: Record<string, string>;
            uploadUrl: string;
          }>(intentResponse);
          const uploadResponse = await fetch(intent.uploadUrl, {
            body: file,
            headers: intent.uploadHeaders,
            method: "PUT",
          });
          if (!uploadResponse.ok) throw new Error(`Storage ปฏิเสธรูป ${file.name}`);
          await readMediaResponse(
            await fetch(`/api/v1/admin/product-media/${intent.assetId}/finalize`, { method: "POST" }),
          );
        uploadedMediaIndexesRef.current.add(index);
        setMediaMessage(`กำลังอัปโหลดรูป ${index + 1}/${mediaFiles.length}`);
      }
      setMediaPhase("success");
      setMediaMessage(`สร้าง ${state.sku} และอัปโหลดรูป ${mediaFiles.length} รูปเรียบร้อย`);
      router.refresh();
    } catch (error) {
      setMediaPhase("error");
      setMediaMessage(error instanceof Error ? `สร้าง SKU แล้ว แต่รูปยังไม่ครบ: ${error.message}` : "อัปโหลดรูปไม่สำเร็จ");
    }
  }, [altText, mediaFiles, router, state.organizationId, state.productModelId, state.productVariantId, state.sku]);

  useEffect(() => {
    if (
      state.status !== "success" ||
      !state.productVariantId ||
      uploadedVariantRef.current === state.productVariantId
    ) return;
    void uploadCreatedMedia();
  }, [state.productVariantId, state.status, uploadCreatedMedia]);

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
              <ThemeSelect
                id="organizationId"
                name="organizationId"
                onValueChange={setOrganizationId}
                options={organizations.map((organization) => ({
                  label: organization.name,
                  value: organization.id,
                }))}
                placeholder="เลือก Organization"
                required
                searchable
                value={organizationId}
              />
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
                <ThemeSelect
                  id="manufacturerId"
                  name="manufacturerId"
                  onValueChange={chooseManufacturer}
                  options={manufacturers.map((manufacturer) => ({
                    label: manufacturer.name,
                    value: manufacturer.id,
                  }))}
                  placeholder="เลือก Brand"
                  required
                  searchable
                  value={manufacturerId}
                />
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
                <ThemeSelect
                  id="productModelId"
                  name="productModelId"
                  onValueChange={setProductModelId}
                  options={availableModels.map((product) => ({
                    label: product.exactModel,
                    value: product.id,
                  }))}
                  placeholder="เลือก Model"
                  required
                  searchable
                  value={productModelId}
                />
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

          <fieldset className="admin-product-section admin-product-media">
            <legend>
              <span>03</span>
              <div>
                <strong>Product media</strong>
                <small>รูปแรกเป็นรูปหลัก ใช้ในคลังอุปกรณ์และ Package Builder</small>
              </div>
            </legend>
            <label className="admin-media-dropzone">
              <input
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []).slice(0, 5);
                  const invalid = files.find(
                    (file) =>
                      file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES ||
                      !PRODUCT_IMAGE_MEDIA_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_MEDIA_TYPES)[number]),
                  );
                  if (invalid) {
                    event.target.value = "";
                    setMediaFiles([]);
                    setMediaPreviews([]);
                    setMediaPhase("error");
                    setMediaMessage(`ไฟล์ ${invalid.name} ต้องเป็น JPEG, PNG หรือ WebP และไม่เกิน 5 MB`);
                    return;
                  }
                  mediaPreviews.forEach((preview) => URL.revokeObjectURL(preview));
                  setMediaFiles(files);
                  uploadedMediaIndexesRef.current.clear();
                  setMediaPreviews(files.map((file) => URL.createObjectURL(file)));
                  setMediaPhase("idle");
                  setMediaMessage("");
                }}
                required
                type="file"
              />
              <ImagePlus aria-hidden="true" size={24} />
              <strong>เลือกรูปสินค้า 1–5 รูป</strong>
              <span>JPEG, PNG หรือ WebP · รูปละไม่เกิน 5 MB</span>
            </label>
            {mediaPreviews.length ? (
              <div className="admin-media-previews" aria-label="รูปสินค้าที่เลือก">
                {mediaPreviews.map((preview, index) => (
                  <figure key={preview} data-primary={index === 0}>
                    {/* Blob preview is local-only and is never persisted as a URL. */}
                    <img alt="" src={preview} />
                    <figcaption>{index === 0 ? "รูปหลัก" : `รูปที่ ${index + 1}`}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            <div className="admin-product-field">
              <label htmlFor="productImageAlt">คำอธิบายรูปสำหรับผู้ใช้ Screen reader</label>
              <input
                id="productImageAlt"
                maxLength={180}
                onChange={(event) => setAltText(event.target.value)}
                placeholder="เช่น แผงโซลาร์ LONGi รุ่น LR5-72HTH มุมด้านหน้า"
                required
                value={altText}
              />
              <small>อธิบายสิ่งที่เห็นโดยไม่ใช้คำว่า “รูปภาพของ”</small>
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
        <p data-status={mediaPhase === "error" ? "error" : state.status} role={state.status === "error" || mediaPhase === "error" ? "alert" : "status"}>
          {state.status === "success" ? <CheckCircle2 size={17} /> : null}
          {mediaMessage || state.message || "ระบบจะสร้าง Product identity, SKU และรูป พร้อม Audit event"}
        </p>
        {mediaPhase === "success" ? (
          <Link className="button button--ink" href="/admin/equipment">
            ไปแนบ Datasheet <ChevronRight size={17} />
          </Link>
        ) : mediaPhase === "error" && state.status === "success" ? (
          <button className="button button--sun" onClick={() => void uploadCreatedMedia()} type="button">
            <UploadCloud size={17} /> ลองอัปโหลดรูปอีกครั้ง
          </button>
        ) : (
          <button className="button button--sun" disabled={!canSubmit || isPending || mediaPhase === "uploading"} type="submit">
            {isPending || mediaPhase === "uploading" ? <LoaderCircle className="spin" size={17} /> : <UploadCloud size={17} />}
            {isPending ? "กำลังสร้าง SKU" : mediaPhase === "uploading" ? "กำลังอัปโหลดรูป" : "บันทึกสินค้า รูป และ SKU"}
          </button>
        )}
      </footer>
    </form>
  );
}
