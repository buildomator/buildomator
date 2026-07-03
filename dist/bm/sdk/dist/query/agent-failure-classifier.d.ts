/**
 * Classify the free-text return body from a dispatched executor subagent into
 * an actionable failure class for the orchestrator's recovery router.
 *
 * Context (#3095): the orchestrator currently treats every non-success agent
 * return as a generic "real failure" except for the Claude Code
 * `classifyHandoffIfNeeded is not defined` runtime bug. Quota / rate-limit
 * terminations look identical to a crashed agent — but the right user
 * response is "wait for reset and resume", not "retry now or abort".
 *
 * Sentinel coverage spans the runtimes GSD supports as executor targets:
 *   - Anthropic / Claude Code  — "usage limit", "rate limit", "quota", "429", "retry-after"
 *   - GitHub Copilot CLI       — "rate limit", "rate_limited", "user_weekly_rate_limited"
 *   - OpenAI Codex CLI         — "429", "usage_limit_reached", "too many requests"
 *   - Google Gemini CLI        — "RESOURCE_EXHAUSTED", "exceeded your", "quota"
 *
 * See docs/research/provider-rate-limit-signals.md for the proactive (header
 * / SDK event) signals the orchestrator could use once the host runtime
 * (Claude Code, Copilot, Codex) exposes them to hooks.
 */
export type AgentFailureClass = 'quota-exceeded' | 'classify-handoff-bug' | 'unknown-failure';
export interface AgentFailureClassification {
    class: AgentFailureClass;
    /** Lower-cased substring that matched, if any. Useful for log lines. */
    sentinel?: string;
    /** Seconds the runtime asked us to wait, parsed from "retry-after: N". */
    retryAfterSeconds?: number;
}
/**
 * Query-handler wrapper for `agent.classify-failure`. Reads the body to
 * classify from the joined positional args (typed via `--`) so workflow
 * shell snippets can pass it as `gsd-sdk query agent.classify-failure -- "$BODY"`.
 */
export declare function agentClassifyFailure(args: string[]): Promise<{
    data: AgentFailureClassification;
}>;
export declare function classifyAgentFailure(body: string): AgentFailureClassification;
//# sourceMappingURL=agent-failure-classifier.d.ts.map