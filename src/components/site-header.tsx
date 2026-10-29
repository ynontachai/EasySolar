import Link from "next/link";
import { ArrowUpRight, Sun } from "lucide-react";

export function SiteHeader({ inverse = false }: { inverse?: boolean }) {
  return (
    <header className={`site-header ${inverse ? "site-header--inverse" : ""}`}>
      <Link className="brand" href="/" aria-label="EasySolar หน้าหลัก">
        <span className="brand__mark" aria-hidden="true">
          <Sun size={18} strokeWidth={1.8} />
        </span>
        <span>EasySolar</span>
      </Link>
      <nav className="main-nav" aria-label="เมนูหลัก">
        <Link href="/equipment">คลังอุปกรณ์</Link>
        <Link href="/checker">Compatibility Checker</Link>
        <Link href="/admin/equipment">Admin</Link>
      </nav>
      <Link className="header-action" href="/checker">
        เริ่มตรวจสอบ
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
    </header>
  );
}
