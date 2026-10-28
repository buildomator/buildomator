# Local models through a litellm gateway

Opt-in advanced path. Claude Code stays the harness; litellm is only an Anthropic-compatible gateway in front of it. The plugin emits model ids and nothing else. Which model serves each tier is your choice, set in config, so moving from qwen3 to deepseek later is a config edit and not a plugin change.

Status: the plugin side (profile resolution, config mapping, validation) is unit-tested. Whether Claude Code accepts an arbitrary model id such as `local-mid` and forwards it to the gateway, instead of validating it against a known Anthropic list, depends on your Claude Code version and has NOT been verified end to end. Run the spike at the bottom before relying on this.

## The three profiles

All three reuse the existing per-agent tier assignment (opus, sonnet, haiku). What changes is which tier resolves to a local id.

| Profile | Tier assignment | opus tier | sonnet tier | haiku tier | Use it when |
|---|---|---|---|---|---|
| `litellm-full` | adaptive | local | local | local | You want zero Anthropic calls (offline, privacy, no cap usage). |
| `litellm-adaptive` | adaptive | Anthropic opus | local | local | Planner, debugger and roadmapper stay on Claude; executor, researchers and checkers run local. |
| `litellm-balanced` | balanced | Anthropic opus | local | local | Like adaptive, but the balanced assignment puts nearly every agent (including the executor) on the sonnet tier, so almost all of them run local. Only the planner and eval-planner stay on Claude. |

Set one with `config-set model_profile litellm-adaptive` (or the other names).

## Configure the local map

In `.planning/config.json`:

```json
{
  "model_profile": "litellm-adaptive",
  "litellm": {
    "api_base": "http://localhost:4000",
    "models": {
      "opus": "local-big",
      "sonnet": "local-mid",
      "haiku": "local-small"
    }
  }
}
```

- `litellm.models.<tier>` names the route litellm serves for that tier. Keys: `opus`, `sonnet`, `haiku`.
- `litellm.api_base` is informational. The plugin does not use it to resolve ids; it records where your gateway lives.
- `litellm.models.<tier>` is shorthand for `model_profile_overrides.litellm.<tier>`. If both are set for a tier, the explicit `model_profile_overrides` value wins.
- A per-agent `model_overrides` entry still beats everything.

Unset tiers:

- `litellm-adaptive` and `litellm-balanced`: an unset sonnet or haiku tier falls back to the Anthropic id for that tier and prints a one-time warning to stderr. The opus tier never needs a local id on these two.
- `litellm-full`: any unset tier (opus, sonnet or haiku) is a hard error, because "full" means no Anthropic. Set all three.

## Gateway setup (outside the plugin)

Run litellm as an Anthropic-compatible gateway and point Claude Code at it:

```sh
export ANTHROPIC_BASE_URL=http://localhost:4000
```

litellm `config.yaml`:

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: anthropic/claude-opus-5-5
      api_key: os.environ/ANTHROPIC_REAL_KEY
  - model_name: local-mid        # whatever you put in litellm.models.sonnet
    litellm_params:
      model: openai/qwen3-coder
      api_base: http://strix.local:8080/v1
      api_key: "sk-local"
  - model_name: local-small      # litellm.models.haiku
    litellm_params:
      model: openai/qwen3-small
      api_base: http://strix.local:8080/v1
      api_key: "sk-local"
  - model_name: local-big        # litellm.models.opus, used only by litellm-full
    litellm_params:
      model: openai/qwen3-max
      api_base: http://strix.local:8080/v1
      api_key: "sk-local"
```

The hybrid profiles send their opus-tier agents to `claude-opus-5-5`, so the gateway needs that passthrough entry (and passthrough entries for any other Anthropic id you let through, such as the sonnet or haiku fallbacks). `litellm-full` needs no Anthropic entry at all.

## Switching model family later

Change the three route names in `litellm.models` and the matching `model_list` entries in litellm. No new profile and no plugin update.

## Spike before you rely on it

The open question is Claude Code's handling of ids it does not recognize. To check, with `litellm-adaptive` and a local map in place and Claude Code pointed at the gateway, run one `/bm:quick` whose executor is sonnet tier and confirm the request shows up in the litellm log and reaches the local box. If Claude Code rejects unknown ids, the fallbacks are: name your local routes with ids Claude Code accepts and rewrite them inside litellm, use Claude Code's own custom-provider configuration if your version has it, or drive the work through the `bm-sdk query` path. The plugin-side resolution is correct regardless of how this spike turns out.
