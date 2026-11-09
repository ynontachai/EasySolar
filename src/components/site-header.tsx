import Link from "next/link";
import { Menu, Sun } from "lucide-react";

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
        <Link className="role-shortcut" href="/#calculator"><span>01</span>คำนวณจับคู่</Link>
        <Link className="role-shortcut" href="/#order"><span>02</span>ตรวจแบบกับทีมวิศวกร</Link>
      </nav>
      <details className="mobile-nav">
        <summary aria-label="เปิดเมนูหลัก">
          <Menu size={22} aria-hidden="true" />
          <span className="sr-only">เมนูหลัก</span>
        </summary>
        <nav className="mobile-nav__panel" aria-label="เมนูหลักสำหรับมือถือ">
          <Link href="/#calculator">
            <span>01</span>
            คำนวณจับคู่
          </Link>
          <Link href="/#order">
            <span>02</span>
            ตรวจแบบกับทีมวิศวกร
          </Link>
        </nav>
      </details>
    </header>
  );
}
