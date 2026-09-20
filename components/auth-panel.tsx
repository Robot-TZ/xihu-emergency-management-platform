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
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="auth-tabs" role="tablist" aria-label="登录或注册"><button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setMessage(""); }}>已有账号登录</button><button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>新成员注册</button></div>
      <h2>{mode === "login" ? "登录西湖应急平台" : "注册团队账号"}</h2>
      <p>{mode === "login" ? "登录后进入工作台，继续处理本人和所属组织的业务。" : "请使用本人邮箱和管理员发放的邀请码；权限在后台统一分配。"}</p>
      <label>邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" /></label>
      <label>密码<div className="password-field"><input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "隐藏" : "显示"}</button></div><small>至少 8 位；请勿与其他网站共用密码。</small></label>
      {mode === "signup" && <label>团队邀请码<input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="由平台主管理员发放" required autoComplete="off" /></label>}
      <button className="primary" disabled={busy || !email || password.length < 8 || (mode === "signup" && !inviteCode.trim())} onClick={() => submit(mode)}>{busy ? "正在处理…" : mode === "login" ? "登录并进入工作台" : "注册账号"}</button>
      {message && <p className="form-message" role="status" aria-live="polite">{message}</p>}
    </div>
  );
}
