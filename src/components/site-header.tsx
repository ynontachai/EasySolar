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
        <Link className="role-shortcut" href="/equipment"><span>01</span>คลังอุปกรณ์</Link>
        <Link className="role-shortcut" href="/checker"><span>02</span>จับคู่แผง–อินเวอร์เตอร์</Link>
        <Link className="role-shortcut" href="/#order"><span>03</span>สั่งซื้อผ่าน LINE</Link>
      </nav>
      <div className="header-actions">
        <Link className="admin-entry" href="/admin/login">
          <LockKeyhole size={15} aria-hidden="true" />
          ผู้ดูแลระบบ
        </Link>
        <Link className="header-action" href="/equipment">
          เปิดคลังอุปกรณ์
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <details className="mobile-nav">
        <summary aria-label="เปิดเมนูหลัก">
          <Menu size={22} aria-hidden="true" />
          <span className="sr-only">เมนูหลัก</span>
        </summary>
        <nav className="mobile-nav__panel" aria-label="เมนูหลักสำหรับมือถือ">
          <Link href="/equipment">
            <span>01</span>
            คลังอุปกรณ์ · Datasheet
          </Link>
          <Link href="/checker">
            <span>02</span>
            จับคู่แผง–อินเวอร์เตอร์
          </Link>
          <Link href="/#order">
            <span>03</span>
            สั่งซื้อผ่าน LINE
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
