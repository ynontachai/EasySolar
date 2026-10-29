import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>EasySolar</strong>
        <p>PV Equipment Intelligence for Solar Professionals.</p>
      </div>
      <div className="site-footer__links">
        <Link href="/checker">สำหรับมืออาชีพ</Link>
        <Link href="/solar-value">ประเมินโซลาร์</Link>
        <Link href="/equipment">คลังอุปกรณ์</Link>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
