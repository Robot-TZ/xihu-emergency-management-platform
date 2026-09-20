<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# 项目工作目录迁移通知（2026-09-20）

**请 Codex 在本项目的新统一位置工作：`/Users/thomasmac/xihu-emergency-management-platform/`**

## 发生了什么
- 本项目（西湖区应急管理综合平台）此前同时存在于两个目录，造成文件重复与割裂：
  - 旧位置 `/Users/thomasmac/Documents/ChatGPT/数字治理`（已移除，源码在废纸篓，可恢复）
  - 新位置 `/Users/thomasmac/xihu-emergency-management-platform`（当前统一位置）
- 两个克隆已合并为单一工作目录；旧副本的 `node_modules`（1.0G）与 `.next`（396M）已删除，释放约 1.4G 空间。
- 最新代码已保留（含界面优化、三潭印月图标、台汛卫士真实地图 + Open-Meteo 动态雨量等）。
- `.env.local` 已从旧副本迁移到新位置（含 Supabase 配置，属 gitignored 文件，勿提交）。

## 协作约定
- 请始终在 `/Users/thomasmac/xihu-emergency-management-platform/` 进行本项目开发，不要再使用旧路径。
- git 远程：`Robot-TZ/xihu-emergency-management-platform`，分支 `main`。
- 本地环境变量见 `.env.local`；腾讯地图 key 经 GitHub Actions Secret `NEXT_PUBLIC_TMAP_KEY` 注入，不写源码。
