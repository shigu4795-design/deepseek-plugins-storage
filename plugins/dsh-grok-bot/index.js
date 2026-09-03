import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import z from "@deepseek-ai/schemastery";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { createAssistantMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import { SessionId } from "@deepseek-ai/dsh-session";
import { defineTool } from "@deepseek-ai/dsh-tools";
//#region src/index.ts
/**
* dsh-grok-bot host engine — M1 Routine：
*   - 数据层：settings 持久化 `grok-bot`（routines[] + trigger）+ `grok-runs`（滚动日志）
*   - 调度：心跳（intervalSeconds，默认 60s）扫描 5 字段 cron（通配 / 枚举 / 区间 / 步进）
*   - 运行：M0 后台 turn 直驱样板（agentOptions + installModelSelection + whenIdle + flush）
*   - 控制：`bot.*` 工具（模型可调）；面板通过 settings 读写 + trigger 字段
*
* 约束：只导出命名符号；inject 列出用到的每个服务；settings 段用 schemastery。
*/
const name = "dsh-grok-bot";
const inject = [
	"timer",
	"agents",
	"settings",
	"sessions",
	"tools"
];
const RoutineBudgetSchema = z.object({
	maxTurns: z.number().min(1).default(void 0),
	maxTokens: z.number().min(100).default(void 0),
	maxSeconds: z.number().min(10).default(void 0)
});
const RoutineSchema = z.object({
	id: z.string().required(),
	name: z.string().required(),
	schedule: z.string().default("0 * * * *"),
	prompt: z.string().default(""),
	enabled: z.boolean().default(true),
	provider: z.string().default(void 0),
	model: z.string().default(void 0),
	needsApproval: z.boolean().default(false),
	budget: RoutineBudgetSchema.default(void 0),
	reportSessionId: z.string().default(void 0),
	failStreak: z.number().min(0).default(0),
	lastRun: z.object({
		at: z.string().required(),
		runId: z.string().required(),
		status: z.string().required(),
		result: z.string().default(""),
		turns: z.number().default(0)
	}).default(void 0)
});
const SettingsSchema = z.object({
	intervalSeconds: z.number().min(10).max(86400).default(60),
	routines: z.array(RoutineSchema).default([]),
	trigger: z.object({
		routineId: z.string().required(),
		token: z.number().required()
	}).default(void 0)
});
const RunDetailItemSchema = z.object({
	t: z.union([
		z.const("turn"),
		z.const("tool"),
		z.const("step"),
		z.const("reason")
	]).required(),
	turn: z.number().required(),
	step: z.number().default(void 0),
	text: z.string().default("")
});
const RunsSchema = z.object({ runs: z.array(z.object({
	routineId: z.string().required(),
	name: z.string().default(""),
	runId: z.string().required(),
	at: z.string().required(),
	status: z.string().required(),
	result: z.string().default(""),
	turns: z.number().default(0),
	reason: z.string().default(""),
	failStreak: z.number().default(0),
	detail: z.array(RunDetailItemSchema).default([])
})).default([]) });
const ActiveRunsSchema = z.object({ runs: z.array(z.object({
	runId: z.string().required(),
	routineId: z.string().required(),
	name: z.string().default(""),
	status: z.union([
		z.const("queued"),
		z.const("approving"),
		z.const("running"),
		z.const("cancelling")
	]).required(),
	startedAt: z.string().required(),
	progress: z.object({
		turns: z.number().default(0),
		tokens: z.number().default(0),
		elapsedMs: z.number().default(0)
	}).default({
		turns: 0,
		tokens: 0,
		elapsedMs: 0
	}),
	budget: z.object({
		maxTurns: z.number().default(void 0),
		maxTokens: z.number().default(void 0),
		maxSeconds: z.number().default(void 0)
	}).default(void 0)
})).default([]) });
const ApprovalsSchema = z.object({ requests: z.array(z.object({
	id: z.string().required(),
	routineId: z.string().required(),
	name: z.string().default(""),
	summary: z.string().default(""),
	at: z.string().required(),
	expiresAt: z.string().required(),
	status: z.union([
		z.const("pending"),
		z.const("approved"),
		z.const("denied")
	]).required(),
	decidedAt: z.string().default(void 0)
})).default([]) });
function parseField(raw, max) {
	const segs = [];
	if (raw === "") return segs;
	for (const part of raw.split(",")) {
		const [range, stepRaw] = part.split("/");
		const step = stepRaw ? Number(stepRaw) : 1;
		if (range === "*") {
			segs.push({
				from: 0,
				to: max,
				step
			});
			continue;
		}
		const [a, b] = range.split("-").map(Number);
		const from = Number(a);
		const to = b === void 0 ? from : Number(b);
		if (Number.isFinite(from) && Number.isFinite(to) && from >= 0 && to >= from && to <= max) segs.push({
			from,
			to,
			step
		});
	}
	return segs;
}
function matchField(segs, value) {
	return segs.some(({ from, to, step }) => value >= from && value <= to && (value - from) % step === 0);
}
function cronMatches(cron, date) {
	const parts = cron.trim().split(/\s+/);
	if (parts.length !== 5) return false;
	return matchField(parseField(parts[0], 59), date.getMinutes()) && matchField(parseField(parts[1], 23), date.getHours()) && matchField(parseField(parts[2], 31), date.getDate()) && matchField(parseField(parts[3], 12), date.getMonth() + 1) && matchField(parseField(parts[4], 6), date.getDay());
}
function summarize(events, fromSeq) {
	let started = false;
	let turns = 0;
	let tokens = 0;
	let text = "";
	let reason;
	for (const event of events) {
		if (event.seq < fromSeq) continue;
		if (event.type === "turn/start") {
			started = true;
			turns++;
			continue;
		}
		if (!started) continue;
		if (event.type === "assistant/message") {
			const joined = event.data.message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
			if (joined !== "") text = joined;
			const u = event.data.usage;
			if (u) tokens += u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
		}
		if (event.type === "turn/end") reason = event.data.reason;
	}
	return {
		text,
		turns,
		tokens,
		reason
	};
}
function reasonMessage(reason) {
	if (reason === void 0) return "";
	if (reason.kind === "error") return `${reason.error.code}: ${reason.error.message}`;
	return reason.kind;
}
/** ============ 引擎 ============ */
const RUN_TIMEOUT_MS = 12e4;
const LAST_RUNS_CAP = 20;
const MIN_REPEAT_MS = 15e3;
/** M3：error 指数退避底座 = tick × 2^(failStreak-1)，封顶 1 小时，done 清 0。 */
const BACKOFF_CAP_MS = 36e5;
/** M4：全局并发上限——同一时刻最多这么多 run（派发制下审批等待/长 run 不再阻塞调度）。 */
const MAX_RUNS_CONCURRENT = 3;
/** M4：运行中预算监控轮询间隔；超限立即 cancel，真正防失控烧 token。 */
const PROGRESS_POLL_MS = 1e3;
/** 审批卡 TTL：超时默认拒绝（计划书 4.4）。 */
const APPROVAL_TTL_MS = 12e4;
const APPROVAL_POLL_MS = 3e3;
/** M4：轨迹日志每轮最多保留的明细条数（防单 run 无限撑爆 settings）。 */
const DETAIL_CAP = 120;
function apply(ctx) {
	const logger = ctx.logger;
	const sectionScope = ctx.settings.register("grok-bot", SettingsSchema);
	const runsScope = ctx.settings.register("grok-runs", RunsSchema);
	const approvalsScope = ctx.settings.register("grok-approvals", ApprovalsSchema);
	const activeScope = ctx.settings.register("grok-active", ActiveRunsSchema);
	const readSection = () => sectionScope.get() ?? {
		intervalSeconds: 60,
		routines: []
	};
	const saveRoutines = (routines) => {
		sectionScope.update({ routines });
	};
	const writeRoutines = saveRoutines;
	const lock = /* @__PURE__ */ new Set();
	const activeRuns = /* @__PURE__ */ new Map();
	/** 把整个 activeRuns 注册表刷盘（供 client 面板订阅）。始终以 Map 为主，全量覆盖。 */
	const syncActive = () => {
		try {
			activeScope.update({ runs: Array.from(activeRuns.values()) });
		} catch {}
	};
	/** 新增/更新一个在跑 run 的快照并全量刷盘。 */
	const upsertActive = (snap) => {
		activeRuns.set(snap.runId, snap);
		syncActive();
	};
	/**
	* settings 可写探测：register() 的真正注册包在 ctx.effect 里延后生效，插件 apply
	* 同步链上的写入会撞上 "namespace not registered"。探测成功前，心跳整轮跳过，
	* 下个 tick 再试——注册生效后自然放行。
	*/
	let settingsWritable = false;
	const probeSettingsWritable = () => {
		if (settingsWritable) return true;
		try {
			activeScope.update({ runs: Array.from(activeRuns.values()) });
			settingsWritable = true;
		} catch {
			return false;
		}
		return true;
	};
	const logPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.grok-bot-runs.jsonl");
	try {
		mkdirSync(dirname(logPath), { recursive: true });
	} catch {}
	const recordJsonl = (entry) => {
		try {
			appendFileSync(logPath, JSON.stringify(entry) + "\n");
		} catch {}
	};
	const runSectionUpdate = (entry) => {
		const current = runsScope.get();
		runsScope.update({ runs: [entry, ...current?.runs ?? []].slice(0, LAST_RUNS_CAP) });
	};
	const fleet = /* @__PURE__ */ new Map();
	const sessionIdFor = (id) => SessionId("routine-" + id.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
	const selectionFor = (r) => ({
		provider: r.provider ?? "wechat-miniprogram",
		model: r.model ?? "Deepseek-v4-flash"
	});
	async function ensureAgent(id, selection) {
		const existing = fleet.get(id);
		if (existing) return existing;
		const compose = {
			agentOptions: selection,
			setup: (agentCtx) => {
				installModelSelection(agentCtx, {
					current: selection,
					assembled: void 0
				});
			}
		};
		try {
			const h = await ctx.agents.resume({
				resumeSessionId: sessionIdFor(id),
				...compose
			});
			fleet.set(id, h.agent);
			return h.agent;
		} catch {
			const h = await ctx.agents.create({
				sessionId: sessionIdFor(id),
				meta: { cwd: process.cwd() },
				...compose
			});
			fleet.set(id, h.agent);
			return h.agent;
		}
	}
	const readApprovals = () => approvalsScope.get()?.requests ?? [];
	const writeApprovals = (requests) => {
		approvalsScope.update({ requests: requests.slice(0, 50) });
	};
	const addApproval = (routine, runId) => {
		const request = {
			id: `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			routineId: routine.id,
			name: routine.name,
			summary: `${routine.prompt.slice(0, 240)}（运行 ${runId}）`,
			at: (/* @__PURE__ */ new Date()).toISOString(),
			expiresAt: new Date(Date.now() + APPROVAL_TTL_MS).toISOString(),
			status: "pending"
		};
		writeApprovals([request, ...readApprovals()]);
		return request;
	};
	const decideApproval = (id, status) => {
		const next = readApprovals().map((r) => r.id === id && r.status === "pending" ? {
			...r,
			status,
			decidedAt: (/* @__PURE__ */ new Date()).toISOString()
		} : r);
		writeApprovals(next);
	};
	/** 等待审批出结果；过期（TTL 默认拒绝）返回 'denied'。 */
	async function awaitApproval(id) {
		const deadline = Date.now() + APPROVAL_TTL_MS + APPROVAL_POLL_MS;
		while (Date.now() < deadline) {
			const request = readApprovals().find((r) => r.id === id);
			if (request && Date.now() > new Date(request.expiresAt).getTime() && request.status === "pending") {
				decideApproval(id, "denied");
				return "denied";
			}
			if (request?.status === "approved") return "approved";
			if (request?.status === "denied") return "denied";
			await new Promise((resolve) => setTimeout(resolve, APPROVAL_POLL_MS));
		}
		decideApproval(id, "denied");
		return "denied";
	}
	/** 📋 汇报：把 bot 结论 append 进用户指定会话（assistant/message + surfaceOp append）。 */
	async function reportTo(routine, entry) {
		const targetId = routine.reportSessionId;
		if (!targetId) return;
		/** complication：session 当前 turn 数 = 该会话最后 assistant/message 的 turn+1（无则 0）。 */
		const target = ctx.sessions.get(SessionId(targetId));
		if (!target) {
			logger.warn(`[grok-bot] report target session ${targetId} not live, skip`);
			return;
		}
		const message = createAssistantMessage({
			content: [{
				type: "text",
				text: `📋 例程「${routine.name}」${entry.status === "done" ? "完毕" : entry.status}\n${entry.result.slice(0, 800)}${entry.reason ? `\n原因：${entry.reason}` : ""}`
			}],
			source: {
				provider: routine.provider ?? "wechat-miniprogram",
				model: routine.model ?? "Deepseek-v4-flash"
			}
		});
		const lastTurn = target.events.reduce((max, e) => {
			if ((e.type === "assistant/message" || e.type === "user/message" || e.type === "tool/result") && e.data && typeof e.data.turn === "number") return Math.max(max, e.data.turn);
			return max;
		}, -1);
		target.append("assistant/message", {
			turn: lastTurn + 1,
			step: 0,
			message
		}, { surfaceOp: "append" });
		try {
			await ctx.sessions.flush(target);
		} catch {}
		logger.info(`[grok-bot] reported to ${targetId}`);
	}
	/** 抽取运行轨迹：turn 边界、工具调用、结束原因（供 bot-logs 详情）。 */
	function collectDetail(events, fromSeq) {
		const detail = [];
		for (const event of events) {
			if (event.seq < fromSeq) continue;
			if (event.type === "turn/start") detail.push({
				t: "turn",
				turn: event.data.turn,
				text: `turn ${event.data.turn} 开始`
			});
			else if (event.type === "tool/call") detail.push({
				t: "tool",
				turn: event.data.turn,
				step: event.data.step,
				text: `→ ${event.data.name}(${String(event.data.arguments).slice(0, 160)})`
			});
			else if (event.type === "turn/end") detail.push({
				t: "reason",
				turn: event.data.turn,
				text: `turn ${event.data.turn} 结束：${reasonMessage(event.data.reason) || "completed"}`
			});
			if (detail.length >= DETAIL_CAP) break;
		}
		return detail;
	}
	/** 跑一轮并汇总：运行中经 onProgress 实时上报进度（驱动面板 + 实时预算拦截）。 */
	async function runTurn(routine, runId, onProgress) {
		const selection = selectionFor(routine);
		const agent = await ensureAgent(routine.id, selection);
		const prompt = routine.prompt && routine.prompt.trim() ? `${routine.prompt}\n\n本次运行编号：${runId}。只输出结论。` : `【例程 ${routine.name}】请输出本周期例行结论，不超过 200 字。\n\n本次运行编号：${runId}。`;
		const budget = routine.budget;
		const startedAt = Date.now();
		const overBy = (out) => {
			if (!budget) return "";
			const elapsed = Date.now() - startedAt;
			if (budget.maxSeconds !== void 0 && elapsed > budget.maxSeconds * 1e3) return `时长超限（${Math.round(elapsed / 1e3)}s/${budget.maxSeconds}s）`;
			if (budget.maxTurns !== void 0 && out.turns > budget.maxTurns) return `轮次超限（${out.turns}/${budget.maxTurns}）`;
			if (budget.maxTokens !== void 0 && out.tokens > budget.maxTokens) return `token 超限（${out.tokens}/${budget.maxTokens}）`;
			return "";
		};
		try {
			await Promise.race([agent.whenIdle(), new Promise((r) => setTimeout(r, 5e3))]);
			const fromSeq = agent.session.seq;
			agent.followup(createUserMessage({
				content: [{
					type: "text",
					text: prompt
				}],
				source: {
					kind: "plugin",
					plugin: "dsh-grok-bot"
				}
			}));
			let over = "";
			const monitor = setInterval(() => {
				const cur = summarize(agent.session.events, fromSeq);
				onProgress({
					turns: cur.turns,
					tokens: cur.tokens,
					elapsedMs: Date.now() - startedAt
				});
				if (!over && budget) {
					const o = overBy(cur);
					if (o) {
						over = o;
						try {
							agent.cancel({ kind: "parent" });
						} catch {}
					}
				}
			}, PROGRESS_POLL_MS);
			try {
				const settled = await Promise.race([agent.whenIdle().then(() => "done"), new Promise((resolve) => setTimeout(() => resolve("timeout"), RUN_TIMEOUT_MS))]);
				if (settled === "timeout") {
					try {
						agent.cancel({ kind: "parent" });
					} catch {}
					try {
						await Promise.race([agent.whenIdle(), new Promise((r) => setTimeout(r, 5e3))]);
					} catch {}
				}
				const out = summarize(agent.session.events, fromSeq);
				const detail = collectDetail(agent.session.events, fromSeq);
				try {
					await ctx.sessions.flush(agent.session);
				} catch {}
				const failed = out.reason?.kind === "error";
				const reason = reasonMessage(out.reason);
				if (over) return {
					status: "budget",
					result: "",
					turns: out.turns,
					tokens: out.tokens,
					reason: over,
					detail
				};
				if (!over && budget) {
					const late = overBy(out);
					if (late) return {
						status: "budget",
						result: "",
						turns: out.turns,
						tokens: out.tokens,
						reason: late,
						detail
					};
				}
				return {
					status: failed ? "error" : settled,
					result: out.text.trim() || "（无文本输出）",
					turns: out.turns,
					tokens: out.tokens,
					reason,
					detail
				};
			} finally {
				clearInterval(monitor);
			}
		} catch (err) {
			return {
				status: "error",
				result: "",
				turns: 0,
				tokens: 0,
				reason: err instanceof Error ? err.message : String(err),
				detail: []
			};
		}
	}
	/**
	* 落盘运行记录 + 更新例程状态（lastRun / failStreak / 预算冻结）+ 汇报。
	* 从 executeRoutine 抽离，让运行结束与调度派发解耦。
	*/
	function finalizeRoutine(routine, runId, outcome) {
		const id = routine.id;
		const entry = {
			routineId: id,
			name: routine.name,
			runId,
			at: (/* @__PURE__ */ new Date()).toISOString(),
			status: outcome.status,
			result: outcome.result,
			turns: outcome.turns,
			reason: outcome.reason,
			failStreak: outcome.status === "done" ? 0 : (routine.failStreak ?? 0) + 1,
			detail: outcome.detail ?? []
		};
		const sec = readSection();
		if (outcome.status === "budget") writeRoutines(sec.routines.map((r) => r.id === id ? {
			...r,
			enabled: false,
			failStreak: entry.failStreak,
			lastRun: {
				at: entry.at,
				runId: entry.runId,
				status: "budget",
				result: outcome.reason,
				turns: outcome.turns
			}
		} : r));
		else writeRoutines(sec.routines.map((r) => r.id === id ? {
			...r,
			failStreak: entry.failStreak,
			lastRun: {
				at: entry.at,
				runId: entry.runId,
				status: outcome.status,
				result: entry.result.slice(0, 200),
				turns: outcome.turns
			}
		} : r));
		recordJsonl(entry);
		runSectionUpdate(entry);
		logger.info(`[grok-bot] ${id} ${outcome.status}${entry.reason ? ` ${entry.reason.slice(0, 120)}` : ""}`);
		reportTo(routine, entry);
	}
	/** 全局并发闸门：同时最多 MAX_RUNS_CONCURRENT 个 run（审批等待/长 run 不再阻塞调度入港）。 */
	let runSlots = MAX_RUNS_CONCURRENT;
	let waiters = [];
	async function acquireSlot() {
		if (runSlots > 0) {
			runSlots--;
			return () => {
				runSlots++;
			};
		}
		await new Promise((resolve) => waiters.push(resolve));
		return acquireSlot();
	}
	/**
	* 派发一个例程运行（审批 + 执行 + 落盘），后台异步完成，不等完成返回。
	* 同一例程（lock）不会并发；返回 promise 在 run 结束后 resolve（供工具等待结果）。
	*/
	function dispatchRoutine(routine, via) {
		const id = routine.id;
		if (lock.has(id)) return Promise.resolve({ status: "locked" });
		lock.add(id);
		const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		return (async () => {
			const release = await acquireSlot();
			const startedAt = Date.now();
			upsertActive({
				runId,
				routineId: id,
				name: routine.name,
				status: "queued",
				startedAt: new Date(startedAt).toISOString(),
				progress: {
					turns: 0,
					tokens: 0,
					elapsedMs: 0
				},
				budget: routine.budget
			});
			try {
				if (routine.needsApproval) {
					upsertActive({
						runId,
						routineId: id,
						name: routine.name,
						status: "approving",
						startedAt: (/* @__PURE__ */ new Date()).toISOString(),
						progress: {
							turns: 0,
							tokens: 0,
							elapsedMs: 0
						},
						budget: routine.budget
					});
					if (await awaitApproval(addApproval(routine, runId).id) === "denied") {
						const denied = {
							routineId: id,
							name: routine.name,
							runId,
							at: (/* @__PURE__ */ new Date()).toISOString(),
							status: "denied",
							result: "",
							turns: 0,
							reason: "审批未通过（超时默认拒绝）"
						};
						recordJsonl(denied);
						runSectionUpdate(denied);
						reportTo(routine, denied);
						return { status: "denied" };
					}
				}
				upsertActive({
					runId,
					routineId: id,
					name: routine.name,
					status: "running",
					startedAt: (/* @__PURE__ */ new Date()).toISOString(),
					progress: {
						turns: 0,
						tokens: 0,
						elapsedMs: 0
					},
					budget: routine.budget
				});
				const outcome = await runTurn(routine, runId, (p) => {
					upsertActive({
						runId,
						routineId: id,
						name: routine.name,
						status: "running",
						startedAt: (/* @__PURE__ */ new Date()).toISOString(),
						progress: p,
						budget: routine.budget
					});
				});
				finalizeRoutine(routine, runId, outcome);
				return {
					status: outcome.status,
					runId,
					via
				};
			} catch (err) {
				const failStreak = (routine.failStreak ?? 0) + 1;
				recordJsonl({
					routineId: id,
					name: routine.name,
					runId,
					at: (/* @__PURE__ */ new Date()).toISOString(),
					status: "error",
					result: "",
					turns: 0,
					reason: err instanceof Error ? err.message : String(err),
					failStreak
				});
				try {
					const sec = readSection();
					writeRoutines(sec.routines.map((r) => r.id === id ? {
						...r,
						failStreak
					} : r));
				} catch {}
				logger.warn(`[grok-bot] ${id} error: ${String(err)}`);
				return {
					status: "error",
					runId
				};
			} finally {
				activeRuns.delete(runId);
				syncActive();
				release();
				lock.delete(id);
				const waiter = waiters.shift();
				if (waiter) waiter();
			}
		})();
	}
	/** bot-run 等旧调用点：直接派发并仅等其完成。 */
	async function executeRoutine(routine) {
		return (await dispatchRoutine(routine, "tool")).status;
	}
	let consumedToken;
	let busy = false;
	/** 过期审批卡（无引擎在等在）→ 标记 denied，避免面板卡死。 */
	function sweepExpiredApprovals() {
		const now = Date.now();
		const changed = readApprovals().map((r) => r.status === "pending" && now > new Date(r.expiresAt).getTime() ? {
			...r,
			status: "denied",
			decidedAt: (/* @__PURE__ */ new Date()).toISOString()
		} : r);
		if (changed.some((r, i) => r !== readApprovals()[i])) try {
			writeApprovals(changed);
		} catch {}
	}
	/** 一次心跳的调度扫描；耗时只在扫描本身，run 的审批/执行都在后台，靠信号量限流。 */
	async function heartbeat() {
		if (busy) return;
		if (!probeSettingsWritable()) return;
		busy = true;
		try {
			sweepExpiredApprovals();
			const sec = readSection();
			const now = /* @__PURE__ */ new Date();
			const tickMs = Math.max(10, sec.intervalSeconds || 60) * 1e3;
			const trigger = sec.trigger;
			if (trigger && trigger.token !== consumedToken) {
				consumedToken = trigger.token;
				const target = sec.routines.find((r) => r.id === trigger.routineId);
				if (target) dispatchRoutine(target, "trigger");
			}
			for (const r of sec.routines) {
				if (!r.enabled) continue;
				if (r.lastRun) {
					const since = now.getTime() - new Date(r.lastRun.at).getTime();
					if (r.lastRun.status === "error") {
						if (since < Math.min(tickMs * 2 ** Math.max(0, (r.failStreak ?? 1) - 1), BACKOFF_CAP_MS)) continue;
					} else if (since < MIN_REPEAT_MS) continue;
				}
				if (cronMatches(r.schedule, now)) dispatchRoutine(r, "heartbeat");
			}
		} catch (err) {
			logger.warn(`[grok-bot] heartbeat: ${String(err)}`);
		} finally {
			busy = false;
		}
	}
	const viewRoutine = (r) => ({
		id: r.id,
		name: r.name,
		enabled: r.enabled,
		schedule: r.schedule,
		prompt: r.prompt,
		provider: r.provider ?? null,
		model: r.model ?? null,
		needsApproval: r.needsApproval ?? false,
		budget: r.budget ?? null,
		reportSessionId: r.reportSessionId ?? null,
		failStreak: r.failStreak ?? 0,
		lastRun: r.lastRun ?? null
	});
	ctx.tools.register(defineTool({
		name: "bot-list",
		description: "列出 dsh-grok-bot 的全部例程及最近一次运行状态。",
		parameters: {},
		output: {
			schema: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			render: (_a, v) => [{
				type: "text",
				text: JSON.stringify(v, null, 2)
			}]
		},
		execute: () => readSection().routines.map(viewRoutine)
	}));
	ctx.tools.register(defineTool({
		name: "bot-add",
		description: "新增一个后台例程，返回新例程 id。示例：每天早上 9 点的摘要例程 schedule=0 9 * * *。",
		parameters: {
			name: {
				type: "string",
				required: true,
				description: "例程显示名"
			},
			schedule: {
				type: "string",
				default: "0 * * * *",
				description: "5 字段 cron：分 时 日 月 周"
			},
			prompt: {
				type: "string",
				default: "",
				description: "每次运行交给模型的例程任务"
			},
			needsApproval: {
				type: "boolean",
				default: false,
				description: "每次运行前需审批卡（默认拒绝，TTL 120s）"
			},
			maxTurns: {
				type: "number",
				default: null,
				description: "预算：轮次上限（null=不限）"
			},
			maxTokens: {
				type: "number",
				default: null,
				description: "预算：token 上限（null=不限）"
			},
			maxSeconds: {
				type: "number",
				default: null,
				description: "预算：时长上限秒（null=不限）"
			},
			reportSessionId: {
				type: "string",
				default: "",
				description: "汇报目标会话 id（空=仅运行日志）"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					id: { type: "string" },
					count: { type: "number" }
				}
			},
			render: (_a, v) => [{
				type: "text",
				text: JSON.stringify(v)
			}]
		},
		execute: async (args) => {
			const sec = readSection();
			const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
			const a = args;
			const routine = {
				id,
				name: String(a.name).slice(0, 60),
				schedule: String(a.schedule ?? "0 * * * *").slice(0, 64),
				prompt: String(a.prompt ?? "").slice(0, 4e3),
				enabled: true,
				needsApproval: a.needsApproval === true,
				budget: a.maxTurns != null || a.maxTokens != null || a.maxSeconds != null ? {
					...a.maxTurns != null ? { maxTurns: a.maxTurns } : {},
					...a.maxTokens != null ? { maxTokens: a.maxTokens } : {},
					...a.maxSeconds != null ? { maxSeconds: a.maxSeconds } : {}
				} : void 0,
				reportSessionId: a.reportSessionId ? String(a.reportSessionId) : void 0
			};
			writeRoutines([...sec.routines, routine]);
			return {
				id,
				count: sec.routines.length + 1
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "bot-update",
		description: "修改一个例程的 schedule/prompt/enabled/审批/预算/汇报目标。",
		parameters: {
			id: {
				type: "string",
				required: true,
				description: "例程 id（bot-list 可见）"
			},
			name: {
				type: "string",
				default: "",
				description: "新显示名（空=不变）"
			},
			schedule: {
				type: "string",
				default: "",
				description: "新 cron（空=不变）"
			},
			prompt: {
				type: "string",
				default: "",
				description: "新任务说明（null=不变）"
			},
			enabled: {
				type: "boolean",
				default: null,
				description: "true/false 或 null=不变"
			},
			needsApproval: {
				type: "boolean",
				default: null,
				description: "true=每次运行需审批卡"
			},
			maxTurns: {
				type: "number",
				default: null,
				description: "预算：轮次上限（null=不变）"
			},
			maxTokens: {
				type: "number",
				default: null,
				description: "预算：token 上限（null=不变）"
			},
			maxSeconds: {
				type: "number",
				default: null,
				description: "预算：时长上限秒（null=不变）"
			},
			reportSessionId: {
				type: "string",
				default: "",
				description: "汇报目标会话 id（空=仅运行日志）"
			},
			resetBudget: {
				type: "boolean",
				default: false,
				description: "true=清空该例程全部预算上限"
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { updated: { type: "boolean" } }
			},
			render: (_m, v) => [{
				type: "text",
				text: JSON.stringify(v)
			}]
		},
		execute: async (args) => {
			const routines = readSection().routines;
			let updated = false;
			const next = routines.map((r) => {
				if (r.id !== args.id) return r;
				updated = true;
				const patch = {};
				const a = args;
				if (a.name !== void 0 && a.name !== "") patch.name = String(a.name).slice(0, 60);
				if (a.schedule !== void 0 && a.schedule !== "") patch.schedule = String(a.schedule).slice(0, 64);
				if (a.prompt !== void 0 && a.prompt !== null) patch.prompt = String(a.prompt).slice(0, 4e3);
				if (a.enabled === true || a.enabled === false) patch.enabled = a.enabled;
				if (a.needsApproval === true || a.needsApproval === false) patch.needsApproval = a.needsApproval;
				if (a.reportSessionId !== void 0 && a.reportSessionId !== "") patch.reportSessionId = String(a.reportSessionId);
				if (a.resetBudget) delete patch.budget;
				else if (a.maxTurns !== void 0 && a.maxTurns !== null || a.maxTokens !== void 0 && a.maxTokens !== null || a.maxSeconds !== void 0 && a.maxSeconds !== null || r.budget) {
					const b = { ...r.budget ?? {} };
					if (a.maxTurns !== void 0 && a.maxTurns !== null) b.maxTurns = a.maxTurns;
					if (a.maxTokens !== void 0 && a.maxTokens !== null) b.maxTokens = a.maxTokens;
					if (a.maxSeconds !== void 0 && a.maxSeconds !== null) b.maxSeconds = a.maxSeconds;
					patch.budget = b;
				}
				return {
					...r,
					...patch
				};
			});
			if (updated) writeRoutines(next);
			return { updated };
		}
	}));
	ctx.tools.register(defineTool({
		name: "bot-remove",
		description: "删除一个例程（含其运行历史）。",
		parameters: { id: {
			type: "string",
			required: true,
			description: "例程 id"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { removed: { type: "boolean" } }
			},
			render: (_v, vv) => [{
				type: "text",
				text: JSON.stringify(vv)
			}]
		},
		execute: async (args) => {
			const sec = readSection();
			const before = sec.routines.length;
			const next = sec.routines.filter((r) => r.id !== args.id);
			if (next.length !== before) {
				writeRoutines(next);
				fleet.delete(String(args.id));
			}
			return { removed: next.length !== before };
		}
	}));
	ctx.tools.register(defineTool({
		name: "bot-run",
		description: "立即运行一次指定例程（不等 cron），返回本轮结果摘要。",
		parameters: { id: {
			type: "string",
			required: true,
			description: "例程 id"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: { done: { type: "boolean" } }
			},
			render: (_v, r) => [{
				type: "text",
				text: JSON.stringify(r)
			}]
		},
		execute: async (args) => {
			const routine = readSection().routines.find((r) => r.id === args.id);
			if (!routine) return {
				done: false,
				error: "该例程不存在"
			};
			await executeRoutine({
				...routine,
				enabled: true
			});
			const last = readSection().routines.find((r) => r.id === args.id)?.lastRun;
			return {
				done: true,
				status: last?.status ?? "done",
				summary: last?.result ?? ""
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: "bot-status",
		description: "查看当前正在运行（含排队中/审批中）的后台例程及其实时预算进度（已用轮次/token/时长）。",
		parameters: {},
		output: {
			schema: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: true
				}
			},
			render: (_a, v) => [{
				type: "text",
				text: JSON.stringify(v, null, 2)
			}]
		},
		execute: () => Array.from(activeRuns.values()).map((r) => ({
			routineId: r.routineId,
			name: r.name,
			runId: r.runId,
			status: r.status,
			startedAt: r.startedAt,
			progress: r.progress,
			budget: r.budget ?? null
		}))
	}));
	ctx.tools.register(defineTool({
		name: "bot-logs",
		description: "查看某次运行的详细轨迹（turn 边界、工具调用、结束原因）。runId 来自 bot-list 的 lastRun.runId 或 bot-run 返回。",
		parameters: { runId: {
			type: "string",
			required: true,
			description: "运行 id（run-…）"
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					found: { type: "boolean" },
					routine: { type: "string" },
					status: { type: "string" },
					detail: {
						type: "array",
						items: {
							type: "object",
							additionalProperties: true
						}
					}
				}
			},
			render: (_v, r) => [{
				type: "text",
				text: JSON.stringify(r, null, 2)
			}]
		},
		execute: async (args) => {
			const entry = (runsScope.get()?.runs ?? []).find((r) => r.runId === args.runId);
			if (!entry) return { found: false };
			return {
				found: true,
				routine: entry.name,
				status: entry.status,
				detail: entry.detail ?? []
			};
		}
	}));
	const tick = Math.max(10, readSection().intervalSeconds || 60);
	try {
		activeScope.update({ runs: [] });
	} catch {}
	const timer = ctx.interval(heartbeat, tick * 1e3);
	ctx.on("dispose", () => {
		timer.dispose();
	});
	logger.info(`dsh-grok-bot loaded (routines + live status, tick ${tick}s, max concurrent ${MAX_RUNS_CONCURRENT})`);
	heartbeat();
}
//#endregion
export { apply, inject, name };
