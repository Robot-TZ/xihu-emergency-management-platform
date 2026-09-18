import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "西湖应急综合平台",
  description: "西湖区应急管理综合平台第一阶段联网演示",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
