# Craft-skills survey: external skills catalog candidates

Date: 2026-10-03
Purpose: systematic overview of popular external Agent Skills (SKILL.md) that could
seed the just-in-time craft catalog (see `jit-skill-catalog-design-261003.md`).
Input for the full-feature spec.

## How to read this

- Buildomator's own 86 skills are the PROCESS layer. Everything below is the CRAFT
  layer: domain technique injected into a bm agent at the point of need, never added
  to the `/bm:` command namespace.
- Popularity is directional only. Install counts come from the skills.sh leaderboard
  (single aggregator, as of 2026-10-03); GitHub star counts were inconsistent across
  scrapes and are not treated as fact. Install counts and repo stars often disagree
  (e.g. prisma/skills ~68 stars but ~330K installs). Treat both as signals, not audit.
- "Scripts?" flags whether the skill bundles executable code. This is the security
  axis: a markdown-only skill is prompt text, a scripts-bundling skill runs code
  (CodeQL, Semgrep, Playwright, Python OOXML, a vendor CLI, an MCP server). Every
  code-executing entry must be inspected/sandboxed before any auto-run.

## Trust tiers (for the catalog's insertion gate)

- **A: vendor-official, low-exec.** Published by the tech's own vendor or Anthropic,
  mostly instructions/references. Preferred. Still pin a commit.
- **B: vendor-official, code-executing.** Official but runs real tooling (scripts,
  CLI, MCP, browser). Allowed only with a script review or sandbox + human approve.
- **C: community / single-source / unverified.** Hold. Manual vetting only, never an
  auto-propose default.

## By domain

### Testing / QA
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| tdd | mattpocock/skills | red-green-refactor loop | ~1.0M | unknown | A/B | add-tests, bm-executor |
| test-driven-development | obra/superpowers-skills | RED-GREEN-REFACTOR + anti-patterns | ~220K | yes | B | add-tests, bm-executor |
| webapp-testing | anthropics/skills | test web apps via Playwright | official | yes | B | add-tests, bm-executor, bm-ui-checker |
| property-based-testing | trailofbits/skills | Hypothesis/fast-check/proptest/Echidna | repo-only | yes | B | add-tests |
| mutation-testing | trailofbits/skills | configure + analyze surviving mutants | repo-only | unknown | B | add-tests |

### Security
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| static-analysis | trailofbits/skills | CodeQL + Semgrep + SARIF | ~7.4k stars | yes | B | secure-phase, bm-security-auditor |
| security-review | getsentry/sentry-skills | vuln-focused security review | repo+list | no | A | secure-phase, bm-security-auditor, bm-code-reviewer |
| find-bugs | getsentry/sentry-skills | bugs/vulns/quality on branch changes | repo+list | no | A | bm-code-reviewer, bm-debugger |
| audit-context-building | trailofbits/skills | deep context before vuln hunting | repo-only | no | A | bm-security-auditor |
| supply-chain-risk-auditor | trailofbits/skills | npm/PyPI/Go advisory audit | repo-only | no | A | secure-phase |
| semgrep-rule-creator | trailofbits/skills | author custom Semgrep rules | repo-only | yes | B | bm-security-auditor |
| building-secure-contracts | trailofbits/skills | smart-contract vuln scanners | repo-only | yes | B | (gap: web3, only if needed) |
| gha-security-review / skill-scanner | getsentry/sentry-skills | GH Actions review; scan skills for issues | repo | no | A | secure-phase (skill-scanner doubles as our catalog vetting tool) |

### Refactoring / code quality / debugging
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| improve-codebase-architecture | mattpocock/skills | refactor + architecture deepening | ~1.0M | unknown | A/B | code-review-fix, bm-executor, map-codebase |
| code-review | mattpocock/skills | standards + spec compliance review | ~660K | unknown | A/B | code-review, bm-code-reviewer |
| diagnosing-bugs | mattpocock/skills | debugging loop + instrumentation | ~708K | unknown | A/B | debug, bm-debugger |
| systematic-debugging | obra/superpowers-skills | 4-phase root-cause process | ~248K | yes | B | debug, bm-debugger |
| verification-before-completion | obra/superpowers-skills | confirm a fix works before done | superpowers | yes | B | bm-verifier, verify-work |
| code-simplifier | getsentry/sentry-skills | clarity/consistency refactors | repo | no | A | code-review-fix |
| django-perf-review | getsentry/sentry-skills | Django perf review | repo | no | A | (gap: Python/Django, if needed) |

### Frontend / UI / design
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| frontend-design | anthropics/skills | distinctive production UI (anti-slop) | ~950K | no | A | ui-phase, bm-ui-researcher, sketch |
| web-design-guidelines | vercel-labs/skills | audit UI vs 100+ a11y/perf/UX rules | ~133K wk | unknown | A | ui-review, bm-ui-checker |
| theme-factory | anthropics/skills | pro themes for artifacts | official | unknown | A/B | ui-phase, sketch |
| canvas-design | anthropics/skills | visual art/layout to PNG/PDF | official | yes | B | sketch |
| figma-implement-design | figma/skills | Figma designs to code | official | unknown | A | ui-phase, bm-executor |
| shadcn-ui | google-labs-code/skills | build shadcn/ui components | list | unknown | A/C | bm-executor (UI) |

### Frameworks
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| react-best-practices | vercel-labs/skills | ~57 React/Next perf rules | ~768K | unknown | A | bm-executor |
| composition-patterns | vercel-labs/skills | compound-component patterns | ~372K | unknown | A | bm-executor |
| react-native-skills | vercel-labs/skills | RN best-practice/perf | ~231K | unknown | A | bm-executor |
| next-best-practices | vercel-labs/skills | Next.js patterns | list | unknown | A | bm-executor |
| remotion-best-practices | remotion-dev/skills | programmatic video in React | ~117K wk | unknown | A | bm-executor |
| building-native-ui / expo-deployment | expo/skills | Expo Router UI; deploy Expo | official | unknown | A/B | bm-executor |
| react-native-best-practices | callstackincubator/skills | RN perf | official | unknown | A | bm-executor |

### Databases
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| postgres-best-practices | supabase/skills | Supabase Postgres practices | ~429K | unknown | A | bm-executor |
| prisma-* (setup/client-api/orm) | prisma/skills | Prisma Postgres/ORM setup + query API | ~325-333K | no (refs only) | A | bm-executor |
| neon-postgres | neondatabase/skills | Neon serverless Postgres | ~212K | unknown | A | bm-executor |
| clickhouse-best-practices | clickhouse/skills | ClickHouse practices | official | unknown | A | bm-executor |
| drizzle-orm (community) | jezweb/..., bobmatnyc/... | Drizzle schema/queries/migrations | community | unknown | C | bm-executor (hold) |

### DevOps / cloud / infra
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| microsoft-foundry / azure-compute / azure-kubernetes / azure-deploy | microsoft/azure-skills | Azure AI/compute/AKS/deploy | ~445-629K | MCP-backed | B | bm-executor |
| wrangler | cloudflare/skills | Workers/KV/R2/D1/Queues deploy | official | yes (CLI) | B | bm-executor |
| building-mcp-server-on-cloudflare / agents-sdk | cloudflare/skills | remote MCP servers; stateful agents | ~3.0k stars | mostly md | A | bm-executor, mcp-builder path |
| terraform-style-guide / refactor-module / terraform-stacks | hashicorp/skills | Terraform HCL/modules/stacks | official | unknown | A | bm-executor |

### Document generation (pure gap: GSD emits only .md)
| Skill | Source | Does | Signal | Scripts | Tier | Fills |
| - | - | - | - | - | - | - |
| docx | anthropics/skills | Word create/edit/analyze | official | yes (Python) | B | docs-update, bm-doc-writer (A4 .docx you already produce) |
| pdf | anthropics/skills | PDF create/extract/forms | ~206K | yes | B | docs-update, bm-doc-writer |
| pptx | anthropics/skills | PowerPoint create/edit | ~231K | yes | B | docs-update, bm-doc-writer |
| xlsx | anthropics/skills | Excel create/edit/analyze | official | yes | B | docs-update, data work |
| doc-coauthoring / internal-comms | anthropics/skills | collaborative docs; internal comms | official | unknown | A/B | docs-update |
| notion-cli / notion-apps | makenotion/skills | Notion CLI + app scaffolds | ~169 stars | yes (CLI) | B | docs-update |

### SEO / marketing (gap: relevant to the pilot-manual SEO work)
| Skill | Source | Does | Signal | Scripts | Tier | Fills |
| - | - | - | - | - | - | - |
| seo-audit | coreyhaines31/marketingskills | diagnose SEO issues | ~220K | no | A | new SEO capability |
| copywriting | coreyhaines31/marketingskills | marketing copy | ~215K | no | A/caution | (conflicts with the no-slop prose rule; vet) |
| ai-seo | coreyhaines31/marketingskills | optimize for LLM/AI-search citation | 2 sources | no | A | directly matches the ASD-STE100/AI-search SEO goal |
| programmatic-seo | coreyhaines31/marketingskills | SEO pages at scale | repo | no | A | new |
| firecrawl-seo-audit | firecrawl/skills | end-to-end SEO audit via Firecrawl | ~114 stars | partly (CLI) | B | new |
| claude-seo | AgriciDaniel/claude-seo | full-stack SEO audit | community | unknown | C | hold |

### Data / analytics (gap)
| Skill | Source | Does | Signal | Scripts | Tier | Fills |
| - | - | - | - | - | - | - |
| query / attach-db / read-file | duckdb/duckdb-skills | SQL + NL-to-SQL over files/DBs | official | yes (CLI) | B | bm-executor, data work |
| xlsx | anthropics/skills | spreadsheet data | official | yes | B | data work |

### Browser automation / scraping
| Skill | Source | Does | Signal | Scripts | Tier | Fills |
| - | - | - | - | - | - | - |
| just-scrape | ScrapeGraphAI/just-scrape | AI scrape/extract/crawl/monitor | ~245K | yes (API) | B/C | research-phase, bm-phase-researcher |
| firecrawl-build-scrape | firecrawl/skills | Firecrawl single-page extract | ~114 stars | partly | B | bm-phase-researcher |
| agent-browser | vercel-labs/agent-browser | browser automation CLI + MCP (NOT a SKILL.md) | ~1.0M | yes | B | companion tool, not a catalog skill |

### AI agent workflows / MCP / meta
| Skill | Source | Does | Signal | Scripts | Tier | Enriches |
| - | - | - | - | - | - | - |
| mcp-builder | anthropics/skills | build MCP servers | official | yes | B | bm-executor (we ship an MCP server) |
| skill-creator | anthropics/skills | scaffold new SKILL.md | ~398K | yes | B | our own skill authoring + spec conformance |
| find-skills | vercel-labs/skills | discover skills by keyword | ~3.7M | no | A | the catalog's own discovery step |
| prompt-optimizer / llm-eval-harness | daymade/claude-code-skills | optimize prompts; run evals | single-src | unknown | C | eval-review, ai-integration-phase (hold) |
| superpowers (brainstorming, subagent-driven-dev) | obra/superpowers-skills | ideation + lifecycle meta | ~351K | yes | B | already our example external plugin-skill (#33) |

## Reverse map: which bm agent each enriches

- **bm-executor** (the big one): frameworks (Vercel/Expo/CallStack), databases (Supabase/Prisma/Neon/ClickHouse), devops (Azure/Cloudflare/HashiCorp), docgen (docx/pdf/pptx/xlsx), data (DuckDB), refactor (improve-architecture, code-simplifier).
- **bm-security-auditor / secure-phase**: Trail of Bits (static-analysis, audit-context, supply-chain, semgrep-rule-creator), Sentry (security-review, gha-security-review, skill-scanner).
- **bm-code-reviewer / code-review(-fix)**: mattpocock code-review, Sentry find-bugs/code-simplifier, improve-codebase-architecture.
- **bm-debugger / debug**: diagnosing-bugs, systematic-debugging, find-bugs.
- **bm-verifier / verify-work**: verification-before-completion (aligns with our test-it-yourself rule).
- **add-tests**: tdd, test-driven-development, webapp-testing, property/mutation-testing.
- **bm-ui-researcher / bm-ui-checker / ui-phase / ui-review / sketch**: frontend-design, web-design-guidelines, theme-factory, figma-implement-design, shadcn-ui.
- **bm-doc-writer / docs-update**: docx/pdf/pptx/xlsx, doc-coauthoring, notion.
- **bm-phase-researcher / research-phase**: just-scrape, firecrawl.

## New capabilities (no current bm home: candidate gaps worth filling)

1. Document generation to Office/PDF (docx/pdf/pptx/xlsx). Strongest gap: you already
   produce A4 .docx. Tier B (Python scripts), vendor-official.
2. SEO / AI-search optimization (seo-audit, ai-seo, programmatic-seo). Directly serves
   the ASD-STE100 / AI-search discoverability goal from the pilot-manual SEO work.
3. Data/analytics over files (DuckDB). Tier B, official.

## Recommended starter catalog (seed the feature with these ~12)

Highest value x highest trust, to prove the propose/insert gate before breadth:
`frontend-design` (A), `web-design-guidelines` (A), `react-best-practices` (A),
`supabase postgres-best-practices` (A), `prisma` set (A), `security-review` (A, Sentry),
`static-analysis` (B, Trail of Bits), `webapp-testing` (B, Playwright),
`docx`/`pdf`/`pptx`/`xlsx` (B, Anthropic), `seo-audit` + `ai-seo` (A), `duckdb query` (B).
Skip Tier C at seed. Use Sentry `skill-scanner` as part of our own vetting of any
candidate before it enters the catalog.

## Data caveats

- Install counts: skills.sh leaderboard only, directional, 2026-10-03.
- Star counts: unreliable across scrapes, not cited as fact.
- "Scripts?" is partly "unknown" because the rendered GitHub tree did not expose every
  `scripts/` dir. Clone + inspect before catalog inclusion, especially Tier B.
- Unverified / omitted (failed two-source bar): googleworkspace/skills (404),
  sanity-io seo-aeo, openai/skills doc/spreadsheet/playwright, several community
  Vue/Svelte/Flutter/AWS/GCP/Docker skills. No verifiable official AWS/GCP/Docker
  skill surfaced; re-check before assuming one exists.

## Sources

anthropics/skills; vercel-labs/skills; prisma/skills; supabase/skills;
neondatabase/skills; microsoft/azure-skills; cloudflare/skills; hashicorp/skills;
figma/skills; expo/skills; callstackincubator/skills; duckdb/duckdb-skills;
makenotion/skills; firecrawl/skills; ScrapeGraphAI/just-scrape;
coreyhaines31/marketingskills; trailofbits/skills; getsentry/sentry-skills;
mattpocock/skills; obra/superpowers-skills; heilcheng/awesome-agent-skills;
VoltAgent/awesome-agent-skills; daymade/claude-code-skills; skills.sh;
firecrawl.dev/blog/best-claude-code-skills.
