# 西湖应急综合平台 第一阶段联网版

这是由原单文件投标演示改造的 Next.js 应用。当前阶段提供：

- Supabase Auth 邮箱密码登录
- Supabase Postgres 持久化
- RLS 用户数据隔离与 viewer/member/admin 基础角色
- 团队邀请码注册与管理员成员权限后台
- 事件、任务、风险工单和操作日志
- 本地访客模式，刷新后数据仍保留
- JSON 导入导出
- Vitest 与 Playwright 自动化测试
- Vercel 部署和 GitHub CI 配置

线上地址：<https://xihu-emergency-stage-one.vercel.app>

## 本地启动

1. 运行 `pnpm install && pnpm dev`。
2. 如需更换 Supabase 项目，复制 `.env.example` 为 `.env.local` 并填写新项目的 Project URL 和 Publishable Key。
3. 新项目依次执行 `supabase/migrations` 内的迁移文件。

当前默认配置连接演示 Supabase 项目；Publishable Key 本身可安全用于浏览器，真正的数据访问由 RLS 控制。未登录时使用浏览器本地存储，便于演示。

## 团队账号

- 新成员使用自己的邮箱和密码注册，并填写团队邀请码。
- 邀请码只以哈希形式保存在数据库，不写入 GitHub。
- 管理员登录后可在“后台管理”页面查看成员并调整 viewer、member、admin 角色。
- viewer 只读，member 可维护业务数据，admin 可查看全局数据并管理成员权限。
- 如邀请码泄露，可在 Supabase 的 `team_invites` 表中将其 `active` 改为 `false`。

## 安全边界

- 浏览器只使用 Supabase Publishable Key，不使用 secret 或 service role key。
- 所有公开业务表均启用 RLS。
- 普通成员默认只能访问自己的数据，管理员可执行全局管理。
- 角色不能由用户在页面中自行提升。
- 本项目仅适合模拟数据和公开演示，不应存放真实政务敏感数据。
