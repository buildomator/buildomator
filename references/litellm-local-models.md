# Running GSD against local models through a gateway

Opt-in advanced path for pointing a GSD run at locally hosted models instead of
Anthropic. Claude Code stays the harness. It talks to an Anthropic-compatible
gateway (for example LiteLLM) through its own native environment variables. The
plugin does no gateway routing of its own: it only emits the tier aliases
(`sonnet`, `opus`, `haiku`) and Claude Code remaps each alias to a local model id.

Keep `.planning/config.json` on a plain profile (`adaptive` or `balanced`) with
no litellm block. The plugin has no litellm gateway profile and no litellm config
key; it never passes a concrete model id on the agent spawn path.

## The routing chain

```
Buildomator tier (light / standard / heavy)
  -> alias haiku / sonnet / opus     via .planning/config.json profile (adaptive or balanced)
  -> local model id                  via ANTHROPIC_DEFAULT_{HAIKU,SONNET,OPUS}_MODEL
  -> ANTHROPIC_BASE_URL              -> the gateway
  -> the gateway's model routes      -> local weights
```

The plugin stops at the alias. Claude Code's per-tier remap turns `sonnet` into
your local route name, sends the request to `ANTHROPIC_BASE_URL`, and the gateway
serves it from the backing local model.

## Environment variables to export

Export these before starting Claude Code. The environment is inherited only by
sessions started after you export it, so set them in the terminal you will launch
Claude Code from (or source them from a provisioning script).

```sh
# Where the gateway lives, and its auth token.
export ANTHROPIC_BASE_URL="http://192.168.1.90:4000"
export ANTHROPIC_AUTH_TOKEN="sk-your-gateway-token"

# Remap each tier alias to a local route name the gateway serves.
export ANTHROPIC_DEFAULT_OPUS_MODEL="your-heavy-local-route"
export ANTHROPIC_DEFAULT_SONNET_MODEL="your-standard-local-route"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="your-light-local-route"
```

The per-tier `ANTHROPIC_DEFAULT_*_MODEL` alias remap needs a recent Claude Code.
Treat the version as approximate: the Claude Code docs tie a version stamp to the
single `ANTHROPIC_DEFAULT_MODEL` variable, not to the per-tier variants, so there
is no firm version number to quote. If the per-tier remap does not take effect,
your Claude Code is likely too old for it.

## Operator caveats

These are measured behaviors of a live local run, not plugin concerns.

- max_tokens reasoning-budget trap. Reasoning models charge their thinking
  against the output budget. A tight `max_tokens` is spent before any answer
  starts, so the request returns HTTP 200 with `stop_reason` `end_turn` and an
  EMPTY content array. An empty content array means raise the budget, not that
  the gateway is down. Use at least 1024 `max_tokens` for probes.
- Prefill-dominated latency. Decode is slow and prefill dominates wall-clock on
  large contexts, and every subagent starts its own context. Set `API_TIMEOUT_MS`
  (for example 1800000) and `CLAUDE_CODE_MAX_CONTEXT_TOKENS` so long prefills do
  not time out and the context window matches the local model.
- Cluster LAN requirement. The gateway host is only reachable on its LAN. Off the
  LAN the gateway address (for example 192.168.1.90) is unreachable, so run from a
  machine on that network.

## Gateway config example

Run the gateway as an Anthropic-compatible endpoint whose `model_list` maps the
local route names your `ANTHROPIC_DEFAULT_*_MODEL` variables point at to the
backing local models. Example LiteLLM `config.yaml`:

```yaml
model_list:
  - model_name: your-heavy-local-route    # ANTHROPIC_DEFAULT_OPUS_MODEL
    litellm_params:
      model: openai/qwen3-235b-a22b
      api_base: http://192.168.1.90:8080/v1
      api_key: "sk-local"
  - model_name: your-standard-local-route  # ANTHROPIC_DEFAULT_SONNET_MODEL
    litellm_params:
      model: openai/glm-4.5-air
      api_base: http://192.168.1.90:8080/v1
      api_key: "sk-local"
  - model_name: your-light-local-route     # ANTHROPIC_DEFAULT_HAIKU_MODEL
    litellm_params:
      model: openai/qwen3.8-flash-next
      api_base: http://192.168.1.90:8080/v1
      api_key: "sk-local"
```

## Running it

1. On the gateway's LAN, export the variables above (or source your provisioning
   script) in a dedicated terminal.
2. Start Claude Code from that terminal so it inherits the environment.
3. Keep `.planning/config.json` on `adaptive` or `balanced` with no litellm block.
4. Run a GSD task. Subagents spawn with tier aliases, Claude Code remaps each to a
   local route, and requests land on the gateway.
