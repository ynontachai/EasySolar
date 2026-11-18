"use client";

import { useFormStatus } from "react-dom";

export function SpecActivationButton({
  active,
  scope,
}: {
  active: boolean;
  scope: "brand" | "model";
}) {
  const { pending } = useFormStatus();
  const subject = scope === "brand" ? "Brand" : "Model";

  return (
    <button
      className="spec-activation-button"
      data-next-active={!active}
      disabled={pending}
      type="submit"
    >
      {pending ? "กำลังบันทึก…" : active ? `Deactivate ${subject}` : `Activate ${subject}`}
    </button>
  );
}
