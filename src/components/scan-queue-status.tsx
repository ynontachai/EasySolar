"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function ScanQueueStatus({ waiting }: { waiting: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!waiting) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 15_000);

    return () => window.clearInterval(interval);
  }, [router, waiting]);

  if (!waiting) return null;

  return (
    <div className="scan-queue-status" role="status">
      <span>มี Datasheet กำลังรอ Malware scan · ระบบตรวจสถานะให้อัตโนมัติทุก 15 วินาที</span>
      <button onClick={() => router.refresh()} type="button">
        <RefreshCw size={15} aria-hidden="true" />
        ตรวจตอนนี้
      </button>
    </div>
  );
}
