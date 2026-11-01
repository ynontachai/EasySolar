"use client";

import { Check } from "lucide-react";

type CatalogCategory = "inverter" | "pv_module";

const options: Array<{ label: string; value: CatalogCategory }> = [
  { label: "PV Module", value: "pv_module" },
  { label: "Inverter", value: "inverter" },
];

export function CatalogCategoryFilter({
  formId,
  selected,
}: {
  formId: string;
  selected: CatalogCategory[];
}) {
  return (
    <fieldset className="catalog-chips">
      <legend>ประเภทอุปกรณ์</legend>
      {options.map((option) => (
        <label className="catalog-chip" key={option.value}>
          <input
            defaultChecked={selected.includes(option.value)}
            form={formId}
            name="category"
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            type="checkbox"
            value={option.value}
          />
          <span>
            <Check aria-hidden="true" size={14} />
            {option.label}
          </span>
        </label>
      ))}
      <p>ไม่เลือก = แสดงทั้งหมด</p>
      <noscript>
        <button form={formId} type="submit">ใช้ตัวกรอง</button>
      </noscript>
    </fieldset>
  );
}
