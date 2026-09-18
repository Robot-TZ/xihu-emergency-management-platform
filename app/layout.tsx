import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "西湖区应急管理综合平台",
  description: "面向应急事件、指令任务、风险普查工单和过程留痕的协同管理平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
