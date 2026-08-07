import type { Metadata } from "next";
import "./globals.css";

const title = "情绪地形图｜在词语之间漫游";
const description = "一张可拖拽、可缩放的中文情绪词地图，探索感受之间连续而细微的边界。";
const siteUrl = "https://arrow36.github.io/qingxu-atlas/";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "zh_CN",
    url: siteUrl,
    images: [{ url: "og.png", width: 1744, height: 909, alt: "情绪地形图" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
