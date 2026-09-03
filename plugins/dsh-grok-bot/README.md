# dsh-grok-bot

Grok Bot 风格的后台自主 Agent —— DeepSeek Harness (DSH) 插件。在常驻 host 进程里按 cron 静默跑
后台例程，支持审批卡、预算实时拦截、运行轨迹详情与 📋 结果汇报，会话头「例程」面板全程可视。

```text
引擎
├─ 调度  心跳（intervalSeconds）扫描 5 字段 cron（通配/枚举/区间/步进）+ 派发制（信号量限流，不阻塞）
├─ 运行  后台 turn 直驱（headless agent + installModelSelection + whenIdle + flush）
│        + 实时预算监控（运行中 cancel 而非事后标记）
├─ 审批  needsApproval → 审批卡（TTL 120s 倒计时、超时默认拒）
├─ 预算  maxSeconds/maxTurns/maxTokens 超限 → 实时中断 + 冻结（enabled:false）
├─ 汇报  reportSessionId → 📋 assistant/message append 到目标会话
├─ 轨迹  collectDetail 记录 turn 边界/工具调用/结束原因 → bot-logs 详情
└─ 稳定  指数退避 + 超时 cancel 回收 + failStreak 落库/可视化
面板  session header「例程」按钮 → 例程列表/立即运行/实时运行区/审批队列/最近运行轨迹
```

## 安装

- 桌面端：在 [DeepSeek 插件市场 (deepseek.stream)](https://deepseek.stream) 搜索 **dsh-grok-bot**，一键安装。
- 命令行：`dsh plugin --profile web add https://github.com/shigu4795-design/deepseek-plugins-storage/plugins/dsh-grok-bot`

## 配置

安装后在 `settings.yaml` 的 `grok-bot:` 段配置（插件已带默认心跳，未配置段也可直接用会话内工具创建例程）：

```yaml
grok-bot:
  intervalSeconds: 60          # 心跳 tick（schemastery 下限 10）
  routines:
    - id: r-digest
      name: 每日摘要
      schedule: 0 9 * * *       # 5 字段 cron
      prompt: 聚焦最近讨论，输出 3-5 条要点
      enabled: true
      provider: deepseek         # 必须 = llm-pi-ai.providers 的键
      model: deepseek-v4-flash
      needsApproval: true        # 每次运行前弹审批卡
      budget:                    # maxSeconds 下限 10；超限实时中断并冻结
        maxSeconds: 300
      reportSessionId: session-… # 结果 📋 append 到该会话
      failStreak: 0              # 连败计数（引擎自动写回，勿手改）
  trigger: { routineId: r-…, token: 123 }  # 面板「立即运行」写这里，心跳消费
```

三个引擎命名空间：`grok-bot`（例程 + trigger）、`grok-runs`（滚动 20 条运行日志，含 failStreak 与
detail 轨迹）、`grok-approvals`（审批卡，最多 50 条）、`grok-active`（运行中实时快照，面板可见）。

## `bot.*` 工具（模型可调）

| 工具 | 作用 |
| --- | --- |
| `bot-list` / `bot-add` / `bot-update` / `bot-remove` | 会话里直接对模型说即可增删改查例程 |
| `bot-run` | 立即运行一次指定例程（不等 cron），返回本轮结果摘要 |
| `bot-status` | 查看正在运行（排队/审批中/运行中）的例程及实时预算进度 |
| `bot-logs <runId>` | 查看某次运行的轨迹详情（turn 边界、工具调用、结束原因） |

## 架构与关键机制

- **派发制调度**：心跳扫描只「派发」不 `await` 完成；全局信号量（`MAX_RUNS_CONCURRENT`=3）
  限流并发，审批等待（≤120s）/长 run 不再阻塞其余 cron 调度。
- **预算实时拦截**：`runTurn` 内置 1s 监控循环读取累计 turns/tokens/时长，任一超限立即
  `agent.cancel({kind:'parent'})` 并标记 `budget` + 冻结例程，而非等 run 结束才事后判定。
- **实时状态**：进程内存注册表 `activeRuns` + `grok-active` 快照，面板实时展示正在运行的
  例程与预算进度；`bot-status` 供模型查询。
- **轨迹详情**：每轮 `collectDetail` 从运行起始 seq 抽取 turn 边界、工具调用、结束原因，随
  `detail` 落 `grok-runs`；`bot-logs <runId>` 可查，面板历史项可展开。
- **后台 turn 直驱**：`ensureAgent` 先 `resume` 常驻会话（`routine-<slug>`），失败则 `create`，
  带 `meta.cwd` 和 `installModelSelection`。`followup → whenIdle → flush`。
- **数据层**：settings 持久化四命名空间；写回走 `scope.update`，重启不丢。
- **审批**：`addApproval` 建卡 → `awaitApproval` 轮询 TTL（超时自动 deny）→ `decideApproval`。
- **预算冻结**：run status=budget → `enabled:false` + lastRun 写入；面板按钮变「启用」。
- **📋 汇报**：`reportTo` 用 `createAssistantMessage` + `target.append('assistant/message',
  …, {surfaceOp:'append'})` + `flush`，语义上是一条 assistant 消息追加。
- **指数退避**：`failStreak` 累计 error/timeout/budget，done 清零。心跳对 error 例程等待
  `min(tick×2^(streak-1), 1h)` 才重试，杜绝永续烧 token。
- **超时回收**：`RUN_TIMEOUT_MS`(120s) 命中 → `agent.cancel({kind:'parent'})` + 再等
  idle ≤5s，防 followup 堆积进僵尸 turn。
- **锁与闸门**：`lock` Set 防同一例程并发；信号量防全局过载；`busy` 防心跳重入；settings
  注册（`ctx.effect` 延后生效）未就绪时心跳整轮跳过、下个 tick 重试；失败例程下轮自动重试（self-heal）。

## 稳定化要点（实践建议）

- `defineTool` JSON-schema 的 `additionalProperties` 必须显式；`react` 用命名导入。
- schemastery 校验（`maxSeconds` 下限 10）违反即宿主启动失败 + tray AutoRestart 循环。
- `llm-pi-ai` provider 整段注册：某 provider 带 `video` modality → 整段 Config 拒 → 零 provider
  → `NO_ADAPTER`。provider 名必须 = 已注册键。
- YAML 里 `schedule: '* * * * *'` 裸星号是 alias 会报错，必须引号。
- 外部改 settings 后需重启 host 才热加载新例程；运行中状态（lastRun/failStreak）会实时写回磁盘。

## 构建

```bash
npm run build        # tsdown：host ESM（index.js）+ client CJS bundle（client.js）
npm run harness:check
```

`src/` 为 TypeScript 源码（host 引擎 + client 面板），`index.js`/`client.js` 为其构建产物。
client 面板遵守平台冻结种子表：bundle 仅外置 react/cordis/client-store/ui-slots/ui-primitives
等平台模块，其余全部内联。

## License

MIT
