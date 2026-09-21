# 参与贡献

感谢你愿意参与西湖区应急管理综合平台。这个仓库既包含可运行产品，也包含投标需求转译、数据库迁移和部署流程。提交改动前，请先阅读本指南，避免误改生产数据、泄露密钥或把模拟能力描述成正式政务接入。

## 1. 先选择贡献方式

- **发现问题**：优先提交 Bug Issue，附复现步骤、浏览器版本和脱敏截图。
- **提出功能**：提交功能建议 Issue，说明使用角色、业务场景、期望结果和验收标准。
- **修改代码**：先建立功能分支，再通过 Pull Request 合并；不要直接向 `main` 推送未经验证的代码。
- **修改数据库**：必须提交可审查的 Supabase migration，不得只在控制台手工改生产库。
- **接入外部系统**：先确认授权、数据分类和接口边界；没有真实接口时必须明确标注“模拟适配”或“待甲方接入”。

小型修复可以直接提交 PR。涉及数据库结构、权限模型、登录、域名、生产部署或大规模页面重构的改动，请先开 Issue 讨论方案。

## 2. 技术栈与目录

| 位置 | 用途 |
| --- | --- |
| `app/` | Next.js App Router 页面、全局样式和认证回调 |
| `components/` | 门户、业务中心、后台和通用界面组件 |
| `lib/` | 类型、演示数据、路由、规则引擎和 Supabase 客户端 |
| `supabase/migrations/` | 数据库结构、RLS、函数、索引和数据迁移 |
| `tests/` | Vitest 单元测试和 Playwright 浏览器流程测试 |
| `docs/SOP.md` | 产品业务流程与系统边界 |
| `docs/TENDER-COVERAGE.md` | 标书需求转译及覆盖矩阵 |
| `.github/workflows/ci.yml` | GitHub Actions 测试和生产部署 |

主要版本要求：Node.js 22 以上、pnpm 11.19.0、Next.js 16、React 19、Supabase。

## 3. 本地启动

```bash
# 1. 克隆仓库
git clone https://github.com/Robot-TZ/xihu-emergency-management-platform.git
cd xihu-emergency-management-platform

# 2. 安装依赖
corepack enable
pnpm install --frozen-lockfile

# 3. 配置本地环境
cp .env.example .env.local

# 4. 启动开发服务器
pnpm dev
```

打开：

- `http://localhost:3000/`：使用 Supabase 登录；
- `http://localhost:3000/?demo=1&view=overview`：本地演示模式，不写入团队云端数据库。

`.env.local` 至少可以配置：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_TMAP_KEY=
```

`NEXT_PUBLIC_*` 会进入浏览器。这里只能使用 Supabase Publishable Key 和允许前端使用的地图 Key；禁止提交 `service_role`、secret key、个人访问令牌、数据库密码或真实邀请码。

## 4. 分支和提交

同步主分支并创建分支：

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/incident-attachment-preview
```

建议分支前缀：

- `feat/`：新功能；
- `fix/`：问题修复；
- `docs/`：文档；
- `test/`：测试；
- `refactor/`：不改变行为的重构；
- `chore/`：依赖、构建和维护工作。

提交信息建议采用 `类型: 简短说明`，例如：

```text
feat: add incident attachment preview
fix: prevent closure with unfinished tasks
docs: clarify Supabase migration workflow
```

一个提交尽量只解决一个问题。不要顺带格式化无关文件，也不要提交 `.env.local`、`.next/`、`node_modules/`、测试报告或本地临时素材。

## 5. 开发约定

### 5.1 业务与界面

- 新功能应明确服务哪类角色：`viewer`、`member`、`admin`，或值班席、领导席、部门席。
- 状态变化必须给出明确动作和结果提示；重要删除、审批、记账、冲销、结案等操作必须二次确认或经过审批。
- 不要用颜色作为唯一信息来源；交互应支持键盘，动态结果应使用可访问状态提示。
- 新模块需考虑桌面端和移动端，不得破坏综合门户与子域名之间的返回路径。
- 所有时间应保存为可解析时间值，展示时再按中文本地时间格式化。

### 5.2 数据和安全

- 所有暴露在 `public` schema 的业务表必须启用 RLS，并同时配置符合实际权限模型的策略。
- 前端权限控制不能代替数据库权限；不要仅靠隐藏按钮保护敏感操作。
- 新增外键时同时评估索引；新增表时明确 Data API grant、Realtime 和审计需求。
- 附件必须进入私有存储桶，通过短期签名 URL 下载。
- 测试和 Issue 中只使用虚构、脱敏或授权数据，不得上传真实个人信息、工作秘密、重要数据或政务敏感数据。

### 5.3 Supabase migration

先使用当前 CLI 创建迁移文件，不要手写时间戳文件名：

```bash
pnpm dlx supabase@latest migration new descriptive_change_name
```

然后在生成的文件中编写 SQL。migration 应做到：

1. 名称和目的清楚；
2. 尽量兼容现有数据，避免破坏性删除；
3. 新表启用 RLS，并明确 `GRANT` 与 policy；
4. 外键、唯一约束、检查约束和必要索引齐全；
5. 可在空白项目按文件名顺序重放；
6. PR 中说明是否已应用到共享 Supabase 项目及回退方式。

不要把生产数据库当作试验环境。涉及删除表、删除列、清空数据或批量重写生产数据时，必须先讨论并准备备份与回退方案。

## 6. 测试要求

提交前至少执行：

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

- 规则、算法和路由变化应补 Vitest 测试；
- 登录、跨模块导航、关键业务闭环和回归问题应补 Playwright 测试；
- 修复 Bug 时，优先先写一个能复现问题的测试；
- 不要为了让 CI 通过而删除断言、跳过测试或降低权限校验。

GitHub Actions 会在 PR 中重新执行安装、Lint、单元测试、生产构建和浏览器测试。只有推送到 `main` 且测试成功后才会部署生产环境。

## 7. Pull Request 流程

```bash
git push -u origin feat/incident-attachment-preview
```

随后在 GitHub 创建 PR，目标分支选择 `main`。PR 需要说明：

1. 为什么修改；
2. 修改了什么；
3. 如何验证；
4. 是否涉及数据库、权限、环境变量、域名或部署；
5. 页面变化的脱敏截图；
6. 尚未完成或依赖甲方授权的部分。

维护者会重点检查业务正确性、RLS 和权限边界、数据迁移安全、移动端与无障碍体验、测试覆盖以及文档是否同步。收到意见后继续推送到同一分支即可更新 PR，不需要重新创建。

## 8. 文档同步规则

以下变化不能只改代码：

- 新增或改变业务流程：更新 `docs/SOP.md`；
- 改变标书覆盖范围或正式交付边界：更新 `docs/TENDER-COVERAGE.md`；
- 新增可见功能、部署方式或使用步骤：更新 `README.md` 和更新日志；
- 新增环境变量：更新 `.env.example`，但不要填写真实密钥；
- 新增数据库结构：提交 `supabase/migrations/` 文件。

## 9. 完成标准

一项贡献只有同时满足以下条件才算完成：

- 功能在目标角色下可以实际操作，而不只是静态页面；
- 刷新后数据不会意外丢失；
- 权限在数据库层和界面层都符合预期；
- 错误、空数据、加载中和无权限状态有清楚反馈；
- 自动化测试、生产构建和相关文档均已更新；
- 模拟数据、公共参考数据和真实接入有明确区分。

## 10. 沟通与安全报告

普通问题和功能建议请使用 GitHub Issues。不要在公开 Issue 中发布账号、邀请码、密钥、未脱敏日志、漏洞利用细节或真实业务数据。发现可能影响生产数据、认证或权限的安全问题时，请先私下联系仓库维护者，确认修复后再决定是否公开。
