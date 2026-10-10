# 演示视频录制说明

项目提供可重复执行的浏览器演示录制脚本。脚本会打开正式站点的演示模式，依次展示：

1. 登录入口与综合门户；
2. 监测值写入、阈值规则、告警认领复核和转事件；
3. 预案匹配、人工启动与任务生成；
4. 指挥席位、大屏和实时动态；
5. 资源推荐与调度状态；
6. 库存单据审核记账；
7. 风险差异确认与模拟回写；
8. 复盘整改；
9. 当前产品边界和下一步。

视频包含步骤字幕和 macOS 中文旁白。录制时使用浏览器本地演示数据，不发送真实政务数据，不展示账号密码、邀请码或 API Key。

## 运行

在 macOS 中执行：

```bash
pnpm record:demo
```

脚本会先生成当前代码的生产构建，再自动启动本地生产模式演示站点并访问：

```text
http://127.0.0.1:3100/?demo=1&view=overview
```

默认输出到不提交 Git 的 `recordings/` 目录。可按需指定：

```bash
DEMO_URL="http://127.0.0.1:3100/?demo=1&view=overview" \
DEMO_VOICE="Tingting" \
DEMO_SPEECH_RATE="185" \
FFMPEG_BIN="/path/to/ffmpeg" \
pnpm record:demo
```

正式域名只用于片头展示登录入口。核心业务操作使用与当前代码一致的本地访客演示模式录制，从而避免正式账号、Supabase 项目暂停或现场网络状态影响视频生成。若明确传入其他 `DEMO_URL`，脚本不会代为启动本地服务。

首次使用前还需要安装 Playwright 的录制组件，并确保电脑能够运行 `ffmpeg`：

```bash
pnpm exec playwright install ffmpeg
brew install ffmpeg
```

如果 `ffmpeg` 不在系统命令路径中，可以通过 `FFMPEG_BIN` 指定其完整位置。

脚本固定录制为 1920×1080 MP4。正式汇报前应完整播放一次，确认字体、旁白、模拟数据标识和各步骤均符合本次汇报口径。
