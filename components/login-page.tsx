"use client";

import { AuthPanel } from "./auth-panel";
import { PLATFORM_DOMAIN, safeReturnUrl } from "@/lib/product-routing";

export function LoginPage({ next }: { next?: string }) {
  const destination = safeReturnUrl(next);
  const confirmUrl = `https://${PLATFORM_DOMAIN}/auth/confirm?next=${encodeURIComponent(destination)}`;
  return <main className="login-page">
    <section className="login-intro">
      <div className="login-brand"><span>湖</span><div><b>西湖应急</b><small>综合管理平台</small></div></div>
      <span className="eyebrow">UNIFIED EMERGENCY OPERATIONS</span>
      <h1>一个入口，协同处置全流程</h1>
      <p>登录后进入综合门户，再按职责进入监测预警、预案、指挥、资源、风险普查等业务子产品。</p>
      <div className="login-features"><span>统一身份</span><span>统一权限</span><span>数据云端保存</span><span>操作全程留痕</span></div>
    </section>
    <section className="login-card">
      <AuthPanel emailRedirectTo={confirmUrl} onDone={() => window.location.assign(destination)} />
      <p className="login-help">新成员注册需要团队邀请码；账号权限由平台主管理员统一配置。</p>
    </section>
  </main>;
}
