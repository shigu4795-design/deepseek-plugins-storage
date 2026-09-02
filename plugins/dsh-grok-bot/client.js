window.__ModuleLoader__.load({
	id: "dsh-grok-bot",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/panel.tsx
		/**
		* Routine panel: one session-header action opening a popover with the routine
		* list (schedule, run-now, enable toggle), the M2 approval queue (allow/deny,
		* TTL countdown), and a rolling recent-runs feed. All data rides the Host
		* settings namespaces through `settingsScope` scopes — no custom RPC, reads
		* are reactive mirror snapshots, writes are path ops.
		*/
		function formatRunAt(iso) {
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			return date.toLocaleString(void 0, {
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit"
			});
		}
		/** Foreground color per run status; pulse for the currently interested one. */
		function statusColor(status) {
			switch (status) {
				case "done": return "#16a34a";
				case "error": return "#dc2626";
				case "timeout": return "#d97706";
				case "budget": return "#9333ea";
				case "denied": return "#64748b";
				default: return "#6b7280";
			}
		}
		/** Foreground color for the live-running status badge. */
		function liveStatusColor(status) {
			switch (status) {
				case "running": return "#16a34a";
				case "approving": return "#d97706";
				case "queued": return "#64748b";
				default: return "#6b7280";
			}
		}
		/** 剩余秒数（本地计算，不写回设置）。 */
		function secondsLeft(expiresAt) {
			return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1e3));
		}
		/**
		* Session-header entry point: renders nothing until the `grok-bot` namespace
		* has a ready section, then a trigger button and, when open, the popover.
		*/
		function GrokPanel({ bot, runs, approvals, active, t }) {
			const section = (0, react.useSyncExternalStore)(bot.subscribe.bind(bot), () => bot.getSnapshot());
			const runSection = (0, react.useSyncExternalStore)(runs.subscribe.bind(runs), () => runs.getSnapshot());
			const approvalSection = (0, react.useSyncExternalStore)(approvals.subscribe.bind(approvals), () => approvals.getSnapshot());
			const activeSection = (0, react.useSyncExternalStore)(active.subscribe.bind(active), () => active.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [queuedId, setQueuedId] = (0, react.useState)();
			const [expandedRun, setExpandedRun] = (0, react.useState)();
			const [, setNowTick] = (0, react.useState)(0);
			const rootRef = (0, react.useRef)(null);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen);
			(0, react.useEffect)(() => {
				const handle = setInterval(() => {
					setNowTick((v) => v + 1);
				}, 1e3);
				return () => {
					clearInterval(handle);
				};
			}, []);
			const ready = section.status === "ready";
			const routines = ready && section.value ? section.value.routines : void 0;
			const history = runSection.status === "ready" && runSection.value ? runSection.value.runs : void 0;
			const approvalsData = approvalSection.status === "ready" && approvalSection.value ? approvalSection.value.requests : void 0;
			const live = activeSection.status === "ready" && activeSection.value ? activeSection.value.runs : void 0;
			const pending = (approvalsData ?? []).filter((r) => r.status === "pending");
			const count = routines?.length ?? 0;
			const runNow = (id) => {
				setQueuedId(id);
				bot.mutate([{
					op: "set",
					path: ["trigger"],
					value: {
						routineId: id,
						token: Date.now()
					}
				}]);
			};
			const toggle = async (routine) => {
				const next = (routines ?? []).map((r) => r.id === routine.id ? {
					...r,
					enabled: !r.enabled
				} : r);
				await bot.mutate([{
					op: "set",
					path: ["routines"],
					value: next
				}]);
				setQueuedId(routine.id);
				setTimeout(() => {
					setQueuedId(void 0);
				}, 2500);
			};
			const decide = (request, status) => {
				const next = (approvalsData ?? []).map((r) => r.id === request.id ? {
					...r,
					status,
					decidedAt: (/* @__PURE__ */ new Date()).toISOString()
				} : r);
				approvals.mutate([{
					op: "set",
					path: ["requests"],
					value: next
				}]);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				style: {
					position: "relative",
					display: "inline-flex"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-expanded": open,
					"aria-haspopup": "dialog",
					"aria-label": t("trigger.aria"),
					title: t("trigger.label"),
					onClick: () => {
						setOpen(!open);
					},
					style: {
						border: "1px solid #d1d5db",
						background: "#ffffff",
						borderRadius: 8,
						padding: "4px 10px",
						fontSize: 13,
						lineHeight: "20px",
						cursor: "pointer"
					},
					children: [
						t("trigger.label"),
						count > 0 ? ` · ${count}` : "",
						pending.length > 0 ? ` · ${pending.length}待批` : ""
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					role: "dialog",
					"aria-label": t("panel.title"),
					style: {
						position: "absolute",
						right: 0,
						top: "calc(100% + 8px)",
						zIndex: 50,
						width: 460,
						maxHeight: 560,
						overflowY: "auto",
						boxSizing: "border-box",
						background: "#ffffff",
						border: "1px solid #e5e7eb",
						borderRadius: 12,
						boxShadow: "0 10px 30px rgba(0, 0, 0, 0.14)",
						padding: 12
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 14,
								fontWeight: 600,
								marginBottom: 10
							},
							children: t("panel.title")
						}),
						!ready && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								color: "#6b7280"
							},
							children: section.status === "unavailable" ? t("unavailable") : t("loading")
						}),
						ready && routines !== void 0 && routines.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								color: "#6b7280",
								marginBottom: 8
							},
							children: t("panel.empty")
						}),
						(routines ?? []).map((routine) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 0",
								borderBottom: "1px solid #f3f4f6"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										flex: 1,
										minWidth: 0
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												fontSize: 13,
												fontWeight: 500,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap"
											},
											children: [
												routine.name,
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														marginLeft: 6,
														color: "#9ca3af",
														fontWeight: 400
													},
													children: routine.schedule
												}),
												routine.budget && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													title: t("badge.budget"),
													style: {
														marginLeft: 6,
														fontSize: 11,
														color: "#7c3aed",
														border: "1px solid #ddd6fe",
														borderRadius: 4,
														padding: "0 4px"
													},
													children: t("badge.budget")
												}),
												routine.reportSessionId && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													title: t("badge.report"),
													style: {
														marginLeft: 6,
														fontSize: 11,
														color: "#0369a1",
														border: "1px solid #bae6fd",
														borderRadius: 4,
														padding: "0 4px"
													},
													children: t("badge.report")
												})
											]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												fontSize: 12,
												color: routine.lastRun ? statusColor(routine.lastRun.status) : "#9ca3af"
											},
											children: [routine.lastRun ? `${t("last.run")} ${formatRunAt(routine.lastRun.at)} · ${t(`status.${routine.lastRun.status}`)}` : "—", typeof routine.failStreak === "number" && routine.failStreak > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												title: t("backoff.hint", { n: routine.failStreak }),
												style: {
													marginLeft: 6,
													fontSize: 11,
													color: "#dc2626",
													border: "1px solid #fecaca",
													borderRadius: 4,
													padding: "0 4px"
												},
												children: [
													t("streak.title"),
													" ",
													routine.failStreak,
													t("streak.unit")
												]
											})]
										}),
										routine.lastRun?.status === "budget" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											style: {
												fontSize: 11,
												color: "#9333ea",
												marginTop: 2
											},
											children: t("frozen.hint")
										})
									]
								}),
								queuedId === routine.id && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										fontSize: 12,
										color: "#6b7280"
									},
									children: t("queued")
								}),
								routine.lastRun?.status === "budget" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									title: t("enable"),
									onClick: () => {
										toggle(routine);
									},
									style: {
										border: "1px solid #7c3aed",
										borderRadius: 6,
										padding: "2px 8px",
										fontSize: 12,
										cursor: "pointer",
										background: "#f5f3ff",
										color: "#7c3aed"
									},
									children: t("enable")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									title: t("run.now"),
									onClick: () => {
										runNow(routine.id);
									},
									style: {
										border: "1px solid #d1d5db",
										background: "#ffffff",
										borderRadius: 6,
										padding: "2px 8px",
										fontSize: 12,
										cursor: "pointer"
									},
									children: t("run.now")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									title: routine.enabled ? t("disable") : t("enable"),
									onClick: () => {
										toggle(routine);
									},
									style: {
										border: "1px solid #d1d5db",
										borderRadius: 6,
										padding: "2px 8px",
										fontSize: 12,
										cursor: "pointer",
										background: routine.enabled ? "#ecfdf5" : "#f3f4f6",
										color: routine.enabled ? "#047857" : "#6b7280"
									},
									children: routine.enabled ? t("disable") : t("enable")
								})] })
							]
						}, routine.id)),
						(live ?? []).length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								fontWeight: 600,
								margin: "12px 0 6px"
							},
							children: t("live.title")
						}), (live ?? []).map((r) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: 8,
								padding: "6px 0",
								borderBottom: "1px solid #f3f4f6"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
									width: 8,
									height: 8,
									borderRadius: "50%",
									flexShrink: 0,
									background: r.status === "running" ? "#22c55e" : r.status === "queued" ? "#f59e0b" : "#3b82f6"
								} }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										flex: 1,
										minWidth: 0
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: 6
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												fontSize: 13,
												fontWeight: 500,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap"
											},
											children: r.name
										}), r.status === "running" && r.budget && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											title: t("badge.budget"),
											style: {
												fontSize: 11,
												color: "#7c3aed",
												border: "1px solid #ddd6fe",
												borderRadius: 4,
												padding: "0 4px"
											},
											children: t("badge.budget")
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											fontSize: 11,
											color: "#6b7280"
										},
										children: r.status === "running" ? t("live.progress", {
											turns: r.progress.turns,
											tokens: r.progress.tokens,
											secs: Math.round(r.progress.elapsedMs / 1e3)
										}) : r.status === "approving" ? t("live.approving.hint") : r.status === "queued" ? t("live.queued.hint") : ""
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										fontSize: 12,
										color: liveStatusColor(r.status),
										flexShrink: 0
									},
									children: t(`live.status.${r.status}`)
								})
							]
						}, r.runId))] }),
						pending.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								fontWeight: 600,
								margin: "12px 0 6px"
							},
							children: t("approve.section")
						}), pending.slice(0, 4).map((request) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								border: "1px solid #fde68a",
								background: "#fffbeb",
								borderRadius: 8,
								padding: 8,
								marginBottom: 6
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 13,
										fontWeight: 500
									},
									children: request.name
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 12,
										color: "#6b7280",
										margin: "2px 0 6px",
										wordBreak: "break-all"
									},
									children: request.summary.slice(0, 120)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: 8
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												decide(request, "approved");
											},
											style: {
												border: "1px solid #16a34a",
												background: "#f0fdf4",
												color: "#15803d",
												borderRadius: 6,
												padding: "2px 12px",
												fontSize: 12,
												cursor: "pointer"
											},
											children: t("approve.approve")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												decide(request, "denied");
											},
											style: {
												border: "1px solid #d1d5db",
												background: "#ffffff",
												color: "#374151",
												borderRadius: 6,
												padding: "2px 12px",
												fontSize: 12,
												cursor: "pointer"
											},
											children: t("approve.deny")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: {
												fontSize: 12,
												color: "#d97706",
												marginLeft: "auto"
											},
											children: secondsLeft(request.expiresAt) > 0 ? t("approve.expires", { secs: secondsLeft(request.expiresAt) }) : t("approve.decided", { status: t("approve.denied") })
										})
									]
								})
							]
						}, request.id))] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 13,
								fontWeight: 600,
								margin: "12px 0 6px"
							},
							children: t("history.title")
						}),
						history === void 0 || history.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								fontSize: 12,
								color: "#9ca3af"
							},
							children: t("history.empty")
						}) : history.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: { padding: "3px 0" },
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "baseline",
									gap: 8,
									fontSize: 12
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											color: statusColor(entry.status),
											fontWeight: 600,
											width: 44,
											flexShrink: 0
										},
										children: t(`status.${entry.status}`)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: {
											color: "#374151",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
											flex: 1
										},
										children: [
											entry.name,
											" — ",
											entry.result.slice(0, 60),
											typeof entry.failStreak === "number" && entry.failStreak > 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: {
													marginLeft: 6,
													color: "#dc2626",
													fontSize: 11
												},
												children: [
													"[",
													t("streak.title"),
													" ",
													entry.failStreak,
													"]"
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: 4,
											flexShrink: 0
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: { color: "#9ca3af" },
											children: formatRunAt(entry.at)
										}), (entry.detail ?? []).length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											onClick: () => {
												setExpandedRun(expandedRun === entry.runId ? void 0 : entry.runId);
											},
											style: {
												border: "none",
												background: "transparent",
												color: "#2563eb",
												fontSize: 11,
												cursor: "pointer",
												padding: 0
											},
											children: expandedRun === entry.runId ? t("detail.hide") : t("detail.show")
										})]
									})
								]
							}), entry.detail && expandedRun === entry.runId && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									margin: "4px 0 4px 44px",
									padding: 6,
									background: "#f9fafb",
									border: "1px solid #f3f4f6",
									borderRadius: 6
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 11,
										fontWeight: 600,
										color: "#6b7280",
										marginBottom: 4
									},
									children: t("detail.title")
								}), entry.detail.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 11,
										color: "#9ca3af"
									},
									children: t("detail.empty")
								}) : entry.detail.map((d, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: {
										fontSize: 11,
										color: d.t === "tool" ? "#0369a1" : "#6b7280",
										padding: "1px 0",
										wordBreak: "break-all",
										fontFamily: "ui-monospace, monospace"
									},
									children: d.t === "tool" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: ["⚙ ", d.text] }) : d.t === "turn" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: ["▶ ", t("detail.turn", { n: d.turn })] }) : d.text
								}, i))]
							})]
						}, entry.runId))
					]
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"trigger.label": "例程",
			"trigger.aria": "后台例程",
			"panel.title": "后台例程",
			"panel.empty": "暂无例程 — 用会话里的 bot-add 工具新增",
			"schedule.title": "调度",
			"last.run": "上次",
			"status.done": "已完成",
			"status.error": "失败",
			"status.timeout": "超时",
			"status.budget": "挂起",
			"status.denied": "拒绝",
			"run.now": "立即运行",
			"disable": "停用",
			"enable": "启用",
			"history.title": "最近运行",
			"history.empty": "还没有运行记录",
			"live.title": "正在运行",
			"live.empty": "当前没有后台运行",
			"live.status.queued": "排队中",
			"live.status.approving": "审批中",
			"live.status.running": "运行中",
			"live.status.cancelling": "停止中",
			"live.progress": "已用 {turns} 轮 / {tokens} token / {secs}s",
			"live.queued.hint": "已排队，等待并发槽",
			"live.approving.hint": "等待审批（TTL 120s）",
			"loading": "加载中…",
			"unavailable": "设置不可用",
			"queued": "已请求，下一轮心跳内执行",
			"approve.section": "待审批",
			"approve.empty": "没有待审批的运行",
			"approve.summary": "摘要",
			"approve.approve": "允许",
			"approve.deny": "拒绝",
			"approve.expires": "剩 {secs} 秒",
			"approve.decided": "已{status}",
			"approve.decidedAt": "于 {time}",
			"approve.approved": "允许",
			"approve.denied": "拒绝",
			"badge.approval": "审批",
			"badge.budget": "预算",
			"badge.report": "汇报",
			"frozen.hint": "触达预算已自动停用 — 可重新启用（预算未重置可能再次冻结）",
			"streak.title": "连败",
			"streak.unit": "次",
			"backoff.hint": "连续失败 {n} 次，下一轮已退避延后",
			"detail.show": "展开轨迹",
			"detail.hide": "收起轨迹",
			"detail.title": "运行轨迹",
			"detail.empty": "本轮无工具调用",
			"detail.turn": "turn {n}",
			"detail.tool": "工具",
			"detail.reason": "结束",
			"detail.text": "文本"
		};
		/** English kernel, key-identical to the Chinese source of truth. */
		const en = {
			"trigger.label": "Routines",
			"trigger.aria": "Background routines",
			"panel.title": "Background routines",
			"panel.empty": "No routines yet — add one with the bot-add tool",
			"schedule.title": "schedule",
			"last.run": "last run",
			"status.done": "done",
			"status.error": "error",
			"status.timeout": "timeout",
			"status.budget": "suspended",
			"status.denied": "denied",
			"run.now": "Run now",
			"disable": "Pause",
			"enable": "Resume",
			"history.title": "Recent runs",
			"history.empty": "No runs yet",
			"live.title": "Running now",
			"live.empty": "Nothing running",
			"live.status.queued": "queued",
			"live.status.approving": "approving",
			"live.status.running": "running",
			"live.status.cancelling": "stopping",
			"live.progress": "{turns} turns / {tokens} tok / {secs}s",
			"live.queued.hint": "queued; waiting for a slot",
			"live.approving.hint": "awaiting approval (120s TTL)",
			"loading": "Loading…",
			"unavailable": "Settings unavailable",
			"queued": "Queued; runs on the next heartbeat",
			"approve.section": "Awaiting approval",
			"approve.empty": "Nothing waiting approval",
			"approve.summary": "Summary",
			"approve.approve": "Approve",
			"approve.deny": "Deny",
			"approve.expires": "{secs}s left",
			"approve.decided": "{status}",
			"approve.decidedAt": "at {time}",
			"approve.approved": "approved",
			"approve.denied": "denied",
			"badge.approval": "approval",
			"badge.budget": "budget",
			"badge.report": "report",
			"frozen.hint": "Auto-paused after hitting budget — resume works, but it may freeze again",
			"streak.title": "failed",
			"streak.unit": "×",
			"backoff.hint": "{n} consecutive failures; next run is backed off",
			"detail.show": "Show trace",
			"detail.hide": "Hide trace",
			"detail.title": "Run trace",
			"detail.empty": "No tool calls this run",
			"detail.turn": "turn {n}",
			"detail.tool": "tool",
			"detail.reason": "ended",
			"detail.text": "text"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: slot registration, dictionaries, settings scopes. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/**
		* Client plugin body. Registers the dictionaries and the header action,
		* binding one settings scope apiece for the panel's reads and writes.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("grok", {
				zh,
				en
			}), "grok-bot: dictionaries");
			const bot = ctx.settingsScope.bind({ namespace: "grok-bot" });
			const runs = ctx.settingsScope.bind({ namespace: "grok-runs" });
			const approvals = ctx.settingsScope.bind({ namespace: "grok-approvals" });
			const active = ctx.settingsScope.bind({ namespace: "grok-active" });
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "grok-bot-panel",
				order: 30,
				locale: "grok",
				inject: () => ({
					bot,
					runs,
					approvals,
					active
				})
			}, GrokPanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
