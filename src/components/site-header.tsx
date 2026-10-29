import Link from "next/link";
import { ArrowUpRight, Menu, Sun } from "lucide-react";

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
        <Link href="/#professionals">สำหรับมืออาชีพ</Link>
        <Link href="/solar-value">ประเมินโซลาร์</Link>
        <Link href="/equipment">คลังอุปกรณ์</Link>
      </nav>
      <Link className="header-action" href="/#choose-path">
        เลือกเครื่องมือ
        <ArrowUpRight size={16} aria-hidden="true" />
      </Link>
      <details className="mobile-nav">
        <summary aria-label="เปิดเมนูหลัก">
          <Menu size={22} aria-hidden="true" />
          <span className="sr-only">เมนูหลัก</span>
        </summary>
        <nav className="mobile-nav__panel" aria-label="เมนูหลักสำหรับมือถือ">
          <Link href="/#professionals">
            <span>01</span>
            สำหรับมืออาชีพ
          </Link>
          <Link href="/solar-value">
            <span>02</span>
            ประเมินโซลาร์
          </Link>
          <Link href="/equipment">
            <span>03</span>
            คลังอุปกรณ์
          </Link>
        </nav>
      </details>
    </header>
  );
}
