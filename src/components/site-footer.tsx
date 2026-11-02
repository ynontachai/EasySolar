import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>EasySolar</strong>
        <p>PV Equipment Intelligence for EPC and Installers.</p>
      </div>
      <div className="site-footer__links">
        <Link href="/equipment">คลังอุปกรณ์</Link>
        <Link href="/checker">จับคู่แผง–อินเวอร์เตอร์</Link>
        <Link href="/admin/login">ผู้ดูแลระบบ</Link>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
