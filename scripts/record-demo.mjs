import { chromium } from "@playwright/test";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const outputDir = path.join(root, "recordings");
const workDir = path.join(outputDir, ".work");
const targetUrl = process.env.DEMO_URL || "http://127.0.0.1:3100/?demo=1&view=overview";
const voice = process.env.DEMO_VOICE || "Tingting";
const speechRate = process.env.DEMO_SPEECH_RATE || "185";
const holdScale = Number(process.env.DEMO_HOLD_SCALE || "1");
const systemFfmpeg = spawnSync("which", ["ffmpeg"], { encoding: "utf8" }).stdout?.trim();
const ffmpegCandidates = [
  process.env.FFMPEG_BIN,
  systemFfmpeg,
  "/opt/homebrew/bin/ffmpeg",
  "/usr/local/bin/ffmpeg",
  "/Users/thomasmac/Library/Application Support/bilibili/ffmpeg/ffmpeg",
].filter(Boolean);
const ffmpeg = ffmpegCandidates.find((candidate) => fs.existsSync(candidate));

if (process.platform !== "darwin") {
  throw new Error("带中文旁白的录制目前需要 macOS 的 say 命令。");
}
if (!ffmpeg) {
  throw new Error("未找到 ffmpeg。可通过 FFMPEG_BIN=/path/to/ffmpeg 指定。");
}

fs.rmSync(workDir, { force: true, recursive: true });
fs.mkdirSync(workDir, { recursive: true });

let localServer;
function stopLocalServer() {
  if (localServer && !localServer.killed) localServer.kill("SIGTERM");
}
process.on("exit", stopLocalServer);
process.on("SIGINT", () => {
  stopLocalServer();
  process.exit(130);
});

async function startLocalServer() {
  if (!targetUrl.startsWith("http://127.0.0.1:3100")) return;
  try {
    const running = await fetch("http://127.0.0.1:3100/?demo=1&view=overview");
    if (running.ok) return;
  } catch {}
  execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  const serverLog = path.join(workDir, "next-server.log");
  const serverLogFd = fs.openSync(serverLog, "a");
  localServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3100"], {
    cwd: root,
    env: process.env,
    stdio: ["ignore", serverLogFd, serverLogFd],
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch("http://127.0.0.1:3100/?demo=1&view=overview");
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  const details = fs.existsSync(serverLog) ? fs.readFileSync(serverLog, "utf8") : "";
  throw new Error(`本地演示站点未能在 60 秒内启动。\n${details}`);
}

function durationSeconds(file) {
  const result = spawnSync(ffmpeg, ["-i", file], { encoding: "utf8" });
  const match = `${result.stdout}\n${result.stderr}`.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`无法读取音频时长：${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

async function installOverlay(page) {
  await page.evaluate(() => {
    document.querySelector("#__demo_caption")?.remove();
    document.querySelector("#__demo_watermark")?.remove();
    document.querySelector("#__demo_cursor")?.remove();

    const caption = document.createElement("div");
    caption.id = "__demo_caption";
    caption.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:1500px;padding:16px 28px;border-radius:14px;background:rgba(4,19,36,.91);color:#fff;font:600 26px/1.45 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;box-shadow:0 10px 36px rgba(0,0,0,.35);text-align:center;pointer-events:none;";
    document.body.appendChild(caption);

    const watermark = document.createElement("div");
    watermark.id = "__demo_watermark";
    watermark.textContent = "西湖区应急管理综合平台 · 教学与投标演示原型";
    watermark.style.cssText = "position:fixed;right:24px;top:20px;z-index:2147483647;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.92);color:#18344f;font:600 15px/1.2 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.16);pointer-events:none;";
    document.body.appendChild(watermark);

    const cursor = document.createElement("div");
    cursor.id = "__demo_cursor";
    cursor.style.cssText = "position:fixed;left:50%;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border:4px solid #ffcf33;border-radius:50%;z-index:2147483647;box-shadow:0 0 0 5px rgba(255,207,51,.28);transition:left .32s ease,top .32s ease,transform .15s ease;pointer-events:none;";
    document.body.appendChild(cursor);
  });
}

async function caption(page, title, text) {
  await installOverlay(page);
  await page.evaluate(({ title, text }) => {
    const node = document.querySelector("#__demo_caption");
    if (node) node.innerHTML = `<strong style="color:#69d5ff">${title}</strong><span style="display:block;margin-top:3px">${text}</span>`;
  }, { title, text });
}

async function point(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  await page.evaluate(({ x, y }) => {
    const cursor = document.querySelector("#__demo_cursor");
    if (cursor instanceof HTMLElement) {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    }
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await page.waitForTimeout(450);
}

async function click(page, locator) {
  await point(page, locator);
  await locator.click();
  await page.waitForTimeout(700);
}

async function openModule(page, heading, view) {
  const url = new URL(targetUrl);
  url.searchParams.set("demo", "1");
  url.searchParams.set("view", view);
  await page.goto(url.toString(), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  await page.waitForTimeout(900);
}

const chapters = [
  {
    title: "项目入口",
    caption: "统一入口、统一身份、统一业务门户",
    narration: "各位老师、同学好。我们组展示的是西湖区应急管理综合平台。平台关注的不只是发现风险，而是把风险交给合适的人，形成任务，跟踪处置，并确认问题真正解决。首先看到的是统一入口。正式用户登录后进入综合门户，不同业务模块共享身份、权限和事件上下文。",
    run: async (page) => {
      await page.goto("https://www.xihuresponse.top", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
    },
  },
  {
    title: "综合门户",
    caption: "先看待办、告警和处置中事件，再进入专业子产品",
    narration: "综合门户集中展示本人待办、活动告警、处置中事件和待办业务。左侧导航对应标书中的监测预警、预案、指挥调度、资源库存、风险普查、值班和复盘等能力。演示数据保存在本机浏览器；正式登录模式的数据由 Supabase 数据库和权限策略管理。",
    run: async (page) => {
      await page.goto(targetUrl, { waitUntil: "networkidle" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "networkidle" });
      const init = page.getByRole("button", { name: "初始化产品数据" });
      if (await init.isVisible()) await click(page, init);
      const portal = page.getByRole("button", { name: "返回综合门户" });
      if (await portal.isVisible()) await click(page, portal);
      await page.getByRole("heading", { name: "我的应急工作台", exact: true }).waitFor();
      await page.waitForTimeout(1800);
      await page.evaluate(() => window.scrollTo({ top: 620, behavior: "smooth" }));
      await page.waitForTimeout(1800);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    },
  },
  {
    title: "监测预警",
    caption: "模拟写入积水监测值，自动执行阈值规则并合并重复告警",
    narration: "下面让一条积水异常告警走完整个流程。台汛卫士同时展示设备位置、趋势、在线状态、数据来源和更新时间。这里明确标注业务监测为模拟数据，公共天气只作参考。我们向模拟适配器写入三十二厘米积水值，系统自动执行阈值规则，并把同一设备的重复异常合并到一条告警中。",
    run: async (page) => {
      await openModule(page, "台汛卫士", "typhoon");
      await page.waitForTimeout(1800);
      const ingest = page.getByRole("heading", { name: "模拟适配器采集" }).locator("..");
      await ingest.scrollIntoViewIfNeeded();
      await ingest.getByLabel("设备").selectOption("asset-depth");
      await ingest.getByLabel("指标编码").fill("water_depth");
      await ingest.getByLabel("监测值").fill("32");
      await ingest.getByLabel("单位").fill("cm");
      await page.waitForTimeout(1200);
      await click(page, ingest.getByRole("button", { name: "写入监测值并执行规则" }));
    },
  },
  {
    title: "告警转事件",
    caption: "认领 → 复核 → 转事件；系统提供依据，人负责作出决定",
    narration: "异常不会绕过人工直接成为处置结论。值班人员先认领，再核实来源、阈值和现场情况。确认需要处置后，才把告警转为事件。误报可以关闭并记录原因。这样既减少重复劳动，也保留谁在什么时间作出了什么判断。",
    run: async (page) => {
      const row = page.getByRole("row").filter({ hasText: "转塘积水点" }).filter({ hasText: /累计\s*3\s*次/ });
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      await click(page, row.getByRole("button", { name: "认领" }));
      await click(page, row.getByRole("button", { name: "复核" }));
      await click(page, row.getByRole("button", { name: "转事件" }));
      await page.getByRole("heading", { name: "预案中心", exact: true }).waitFor();
    },
  },
  {
    title: "预案匹配与启动",
    caption: "展示匹配理由，人工确认版本，再按模板生成责任任务",
    narration: "进入预案中心后，系统按照事件类型、响应等级、关键词和配置权重计算候选预案，并逐项展示推荐理由。指挥人员选择已发布版本并人工确认。启动后，系统保留本次依据的具体版本，再按照任务模板生成责任任务。当前实现的是可解释规则匹配；语义模型仍需真实语料和准确率验收。",
    run: async (page) => {
      const match = page.getByRole("heading", { name: "事件匹配与启动" }).locator("..");
      await match.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1700);
      await click(page, match.getByRole("button", { name: "人工确认并启动" }).first());
      await page.waitForTimeout(1600);
    },
  },
  {
    title: "统一指挥",
    caption: "一张图、不同席位、事件时间线与现场反馈复核",
    narration: "任务生成后进入指挥调度。同一个事件在值班席、领导席和部门席呈现不同重点。值班席负责全过程操作和反馈复核，领导席查看决策摘要，部门席关注本部门协同。事件、风险点、救援力量、仓库、场所和设备统一落图，右侧时间线持续展示事件动态。页面实时刷新不等同于短信、电话或浙政钉已经送达。",
    run: async (page) => {
      await openModule(page, "指挥调度", "command");
      await page.getByRole("img", { name: /态势图/ }).waitFor();
      await page.waitForTimeout(1300);
      await click(page, page.getByRole("button", { name: "领导席" }));
      await page.waitForTimeout(1400);
      await click(page, page.getByRole("button", { name: "部门席" }));
      await page.waitForTimeout(1200);
      await click(page, page.getByRole("button", { name: "值班席" }));
      await click(page, page.getByRole("button", { name: "进入大屏" }));
      await page.waitForTimeout(1700);
      await click(page, page.getByRole("button", { name: "退出大屏" }));
    },
  },
  {
    title: "资源调度",
    caption: "按区域、能力和可用状态推荐，并跟踪到出动、到场和归队",
    narration: "应急资源模块不是一张静态名单。系统结合事件区域、能力需求和资源可用状态给出候选项，同时展示推荐依据。调度形成申请后，还要经过审批、出动、到场和归队。只有跟踪到归队，下一次事件发生时，系统才知道这支队伍或这辆车是否仍然可用。",
    run: async (page) => {
      await openModule(page, "应急资源", "resources");
      await page.getByRole("heading", { name: "应急资源", exact: true }).waitFor();
      const recommendations = page.getByRole("heading", { name: "事件周边资源推荐与申请" }).locator("..");
      await recommendations.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2600);
      const dispatch = page.getByRole("heading", { name: "资源调度全过程" }).locator("..");
      await dispatch.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
    },
  },
  {
    title: "库存记账",
    caption: "草稿 → 提交审核 → 审核记账；只有记账后才改变库存余额",
    narration: "物资库存通过业务单据控制数量变化。这里建立一张移动排涝泵入库单，先保存草稿，再提交审核，最后由有权限的人员审核记账。只有记账成功后，库存余额才会原子更新。已记账业务不能简单删除，需要通过冲销记录保留完整账目。",
    run: async (page) => {
      await openModule(page, "仓储物资", "inventory");
      const form = page.getByRole("heading", { name: "新建库存业务单" }).locator("..");
      await form.scrollIntoViewIfNeeded();
      await form.locator('select[name="toWarehouseId"]').selectOption("wh-district");
      await form.locator('select[name="itemId"]').selectOption("item-pump");
      await form.locator('input[name="quantity"]').fill("2");
      await page.waitForTimeout(1000);
      await click(page, form.getByRole("button", { name: "创建草稿" }));
      await click(page, page.getByRole("button", { name: "提交审核" }).first());
      page.once("dialog", (dialog) => dialog.accept());
      await click(page, page.getByRole("button", { name: "审核并记账" }).first());
      await page.waitForTimeout(1800);
    },
  },
  {
    title: "风险数据治理",
    caption: "比较差异、人工确认、模拟回写并保留对账结果",
    narration: "风险普查是一条独立的数据治理流程。系统记录数据来源，比较新增、变更和删减，把差异派给责任单位核查，再形成幂等回写任务。现在展示的是明确标识的模拟适配器。取得正式数据仓接口后，还要完成字段映射、身份认证、失败重试和全量对账，才能作为正式接入验收。",
    run: async (page) => {
      await openModule(page, "风险普查", "risks");
      const row = page.getByRole("row").filter({ hasText: "转塘演示安置点A" });
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
      await click(page, row.getByRole("button", { name: "确认并回写" }));
      await page.waitForTimeout(1700);
    },
  },
  {
    title: "复盘整改",
    caption: "事件结束后继续跟踪问题、责任单位、整改期限和销号复核",
    narration: "事件结案以后，系统进入灾后复盘，自动汇集事件和任务时间线。复盘发现的问题继续转成整改任务，明确责任单位和整改期限，并依次经过待整改、整改中、待复核和已销号。这样复盘报告不只是被保存下来，发现的问题也有后续处理和复核依据。",
    run: async (page) => {
      await openModule(page, "灾后复盘", "reviews");
      await page.getByRole("heading", { name: "灾后复盘", exact: true }).waitFor();
      await page.waitForTimeout(1800);
      const issues = page.getByRole("heading", { name: "问题、整改与销号" }).locator("..");
      await issues.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2400);
    },
  },
  {
    title: "当前边界与下一步",
    caption: "已形成可操作、可保存、可追溯的产品原型；正式接入与交付仍需专项实施",
    narration: "目前，项目已经从单文件演示升级为具备身份认证、数据保存、权限控制和完整业务状态的产品原型。真实政务接口、旧系统迁移、信创适配、等保测评、培训和正式运维仍需甲方提供环境并专项实施。我们希望平台最终帮助使用者随时回答清楚：发生了什么，谁负责处理，处理到了哪一步，还有哪些问题没有解决。谢谢大家。",
    run: async (page) => {
      await openModule(page, "我的应急工作台", "portal");
      await page.getByRole("heading", { name: "我的应急工作台", exact: true }).waitFor();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await page.waitForTimeout(1800);
    },
  },
];

const audioFiles = [];
for (const [index, chapter] of chapters.entries()) {
  const audio = path.join(workDir, `${String(index + 1).padStart(2, "0")}.aiff`);
  execFileSync("say", ["-v", voice, "-r", speechRate, "-o", audio, `${chapter.narration} [[slnc 2400]]`]);
  chapter.durationMs = Math.ceil(durationSeconds(audio) * 1000);
  audioFiles.push(audio);
}

await startLocalServer();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: workDir, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
const video = page.video();

for (const chapter of chapters) {
  const started = Date.now();
  await chapter.run(page);
  await caption(page, chapter.title, chapter.caption);
  const remaining = chapter.durationMs * holdScale - (Date.now() - started);
  if (remaining > 0) await page.waitForTimeout(remaining);
}

await page.waitForTimeout(800);
await context.close();
await browser.close();
const rawVideo = await video.path();

const concatList = path.join(workDir, "audio.txt");
fs.writeFileSync(concatList, audioFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
const narration = path.join(workDir, "narration.wav");
execFileSync(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", concatList, "-c:a", "pcm_s16le", narration], { stdio: "inherit" });

const stamp = new Date().toISOString().slice(0, 10);
const output = path.join(outputDir, `西湖区应急管理综合平台-演示流程-${stamp}.mp4`);
execFileSync(ffmpeg, [
  "-y",
  "-i", rawVideo,
  "-i", narration,
  "-c:v", "libx264",
  "-preset", "medium",
  "-crf", "20",
  "-pix_fmt", "yuv420p",
  "-c:a", "aac",
  "-b:a", "192k",
  "-shortest",
  "-movflags", "+faststart",
  output,
], { stdio: "inherit" });

console.log(`\n录制完成：${output}`);
stopLocalServer();
