import type { Metadata } from "next";
import "@fontsource/kanit/300.css";
import "@fontsource/kanit/400.css";
import "@fontsource/kanit/500.css";
import "@fontsource/kanit/600.css";
import "@fontsource/kanit/700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://easysolar.in.th"),
  title: {
    default: "EasySolar — PV Equipment Intelligence",
    template: "%s | EasySolar",
  },
  description:
    "ค้นหาสเปก ตรวจสอบ PV–Inverter compatibility และออกแบบ String เบื้องต้นอย่างโปร่งใส",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
