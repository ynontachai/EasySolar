import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>EasySolar</strong>
        <p>PV Equipment Intelligence for Solar Professionals.</p>
      </div>
      <div className="site-footer__links">
        <Link href="/#epc">EPC / Installer</Link>
        <Link href="/checker">Engineer</Link>
        <Link href="/solar-value">ประเมินโซลาร์</Link>
        <Link href="/community-buy">Community Buy</Link>
        <Link href="/admin/login">ผู้ดูแลระบบ</Link>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
