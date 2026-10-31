import Link from "next/link";
import { ArrowUpRight, LockKeyhole, Menu, Sun } from "lucide-react";

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
        <Link href="/#epc">EPC</Link>
        <Link href="/#engineer">Engineer</Link>
        <Link href="/solar-value">ประเมินโซลาร์</Link>
        <Link href="/community-buy">Community Buy</Link>
      </nav>
      <div className="header-actions">
        <Link className="admin-entry" href="/admin/login">
          <LockKeyhole size={15} aria-hidden="true" />
          ผู้ดูแลระบบ
        </Link>
        <Link className="header-action" href="/#choose-path">
          เลือกเครื่องมือ
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <details className="mobile-nav">
        <summary aria-label="เปิดเมนูหลัก">
          <Menu size={22} aria-hidden="true" />
          <span className="sr-only">เมนูหลัก</span>
        </summary>
        <nav className="mobile-nav__panel" aria-label="เมนูหลักสำหรับมือถือ">
          <Link href="/#epc">
            <span>01</span>
            EPC / Installer
          </Link>
          <Link href="/#engineer">
            <span>02</span>
            Engineer
          </Link>
          <Link href="/solar-value">
            <span>03</span>
            ผู้ใช้ไฟ · ประเมินโซลาร์
          </Link>
          <Link href="/community-buy">
            <span>04</span>
            Community Buy
          </Link>
          <Link href="/admin/login">
            <span aria-hidden="true"><LockKeyhole size={14} /></span>
            ผู้ดูแลระบบ
          </Link>
        </nav>
      </details>
    </header>
  );
}
