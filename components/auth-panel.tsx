"use client";

import { useState } from "react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

async function hashInviteCode(code: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code.trim()));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function AuthPanel({ onDone, emailRedirectTo }: { onDone: () => void; emailRedirectTo?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(mode: "login" | "signup") {
    if (!hasSupabaseConfig()) return setMessage("认证服务暂不可用，请联系平台主管理员。");
    if (mode === "signup" && !inviteCode.trim()) return setMessage("注册新账号需要团队邀请码。");
    setBusy(true); setMessage("");
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailRedirectTo || `${window.location.origin}/auth/confirm` },
        });
    if (result.error) { setBusy(false); return setMessage(result.error.message); }
    if (result.data.session) {
      const profile = await supabase.from("profiles").insert({ id: result.data.session.user.id, email: result.data.session.user.email, role: "viewer" });
      if (profile.error && profile.error.code !== "23505") { setBusy(false); return setMessage("用户资料初始化失败：" + profile.error.message); }
    }
    if (result.data.session && inviteCode.trim()) {
      const codeHash = await hashInviteCode(inviteCode);
      const { error } = await supabase.from("invite_redemptions").insert({ user_id: result.data.session.user.id, code_hash: codeHash });
      if (error) { setBusy(false); return setMessage("邀请码激活失败：" + error.message); }
    }
    setBusy(false);
    setMessage(mode === "signup" && !result.data.session ? "注册成功；请确认邮件后，登录时再次填写邀请码。" : "登录成功");
    if (result.data.session) onDone();
  }

  return (
    <div className="auth-panel">
      <h2>登录西湖应急平台</h2>
      <p>使用统一账号进入综合门户，业务数据将安全保存到云端。</p>
      <label>邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label>
      <label>密码<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} /></label>
      <label>团队邀请码<input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="新成员注册必填；已有账号可留空" autoComplete="off" /></label>
      <div className="actions"><button className="primary" disabled={busy} onClick={() => submit("login")}>登录</button><button disabled={busy} onClick={() => submit("signup")}>注册</button></div>
      {message && <p className="form-message">{message}</p>}
    </div>
  );
}
