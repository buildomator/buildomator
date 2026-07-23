# Community-Health Advisory

Advise on missing community-health files (LICENSE, SECURITY.md) when a project is a
**public GitHub repo**. The advisory only ever PROPOSES. It never writes a file without
the maintainer explicitly selecting an option.

## When it runs (fail-soft detection)

Run these checks. If any step errors, is missing, or does not match, the advisory
**does not fire** and prints nothing. It must never error out or interrupt the health check.

```bash
# 1. Origin must be a GitHub remote.
REMOTE=$(git remote get-url origin 2>/dev/null || true)
case "$REMOTE" in
  *github.com*) ;;         # continue
  *) exit 0 ;;             # non-GitHub or no remote: advisory does not fire
esac

# 2. Repo must be PUBLIC (needs gh, authenticated). Missing gh: advisory does not fire.
command -v gh >/dev/null 2>&1 || exit 0
VIS=$(gh repo view --json visibility --jq .visibility 2>/dev/null || true)
[ "$VIS" = "PUBLIC" ] || exit 0
```

If both pass, the repo is a public GitHub repo. Now check for the two files.

## Missing-file detection

A file counts as present if it exists in any GitHub-recognized location: repo root,
`docs/`, or `.github/`. Check each and treat a match in any location as "present".

```bash
have_file() {
  # $1 = base name glob (e.g. LICENSE, LICENSE.*, SECURITY.md)
  for dir in . docs .github; do
    ls "$dir"/$1 >/dev/null 2>&1 && return 0
  done
  return 1
}

have_file 'LICENSE*'  || MISSING_LICENSE=1
have_file 'SECURITY.md' || MISSING_SECURITY=1
```

If neither is missing, print nothing. Otherwise present the advisory below for each
missing file.

## LICENSE advice: reconcile declared-vs-file

First determine whether a license is already **declared** anywhere, even though no
LICENSE file exists:

- A manifest `license` field: `package.json`, `.claude-plugin/plugin.json`,
  `pyproject.toml`, `Cargo.toml`, `composer.json`, etc.
- An SPDX identifier stated in docs (README, a docs page).

```bash
# Example: read a declared SPDX id from common manifests (best effort).
DECLARED=$(node -e 'try{process.stdout.write(require("./package.json").license||"")}catch(e){}' 2>/dev/null)
[ -z "$DECLARED" ] && DECLARED=$(node -e 'try{process.stdout.write(require("./.claude-plugin/plugin.json").license||"")}catch(e){}' 2>/dev/null)
```

**Case A: a license is declared but the LICENSE file is missing.**
This is mechanical. Propose adding the LICENSE file that matches the declared SPDX id
(for example, a declared `MIT` gets the MIT template below). No choice is needed; state
that you will add the matching file only once the maintainer confirms.

**Case B: nothing is declared anywhere.**
Do not pick a license. Present the tradeoff and let the maintainer choose:

- **GPLv3** (copyleft): derivatives must stay open under the same license. Keeps the
  work and everything built on it free.
- **MIT / BSD** (permissive): anyone may reuse the code, including in proprietary,
  closed-source products, with attribution.
- **Other / none**: the maintainer may prefer a different license, or intentionally
  keep the repo all-rights-reserved.

Ask which the maintainer wants, then add the matching LICENSE file only after they
select. Never choose for them.

## SECURITY.md advice

If SECURITY.md is missing, propose a short disclosure-policy file. Key properties:

- **Channel:** GitHub private vulnerability reporting (the repo's **Security** tab,
  **Report a vulnerability**), so reports stay out of public issues.
- **Scope:** frame the threat around attacker-controlled input executed as unintended
  code. For a plugin like this, that means a crafted planning document or a poisoned
  upstream artifact driving a hook, `gsd-tools`, or the MCP server into arbitrary shell
  execution or reading and writing files outside the project.
- **Out of scope:** commands the maintainer deliberately runs, their own
  misconfiguration, and upstream software (Claude Code, Node.js) rather than this
  project's own code.

Use the SECURITY.md template below (this repo's own root SECURITY.md). Adjust the
project name and the concrete component list to fit the target project.

## Templates

Include these only as proposals. Fill the placeholders, then write the file only after
the maintainer confirms.

### MIT LICENSE

```
MIT License

Copyright (c) {year} {holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### GPLv3

Do not inline the full text. Fetch it from
https://www.gnu.org/licenses/gpl-3.0.txt and save it as the LICENSE file, then add
the standard per-file header if the maintainer wants it.

### SECURITY.md

```markdown
# Security Policy

{Project} runs code on your machine: session hooks, an MCP server, a CLI, and git
operations. Reports about that surface are welcome.

## Reporting a vulnerability

Please report security issues **privately**, not in a public issue or discussion.

Use GitHub's private vulnerability reporting: go to the repository's **Security** tab
and click **Report a vulnerability**. That opens a private advisory visible only to the
maintainer.

This is a solo-maintained project, so response times are best effort. You will get an
acknowledgement as soon as it is seen, and a fix or a decision as quickly as is
practical. If a report is valid and you would like credit, say so and you will be
credited in the advisory and release notes.

## Supported versions

Only the latest released version line receives security fixes. Please reproduce on the
current release before reporting.

## Scope

**In scope:** the project executing attacker-controlled input as code you did not
intend. For example, a crafted planning document or a poisoned upstream artifact that
drives a hook, the CLI, or the MCP server into arbitrary shell execution, or into
reading or writing files outside the project.

**Out of scope:** commands you deliberately run yourself, your own misconfiguration, and
vulnerabilities in Claude Code, Node.js, or other upstream software rather than in this
project's own code.
```

## Hard rule

The advisory PROPOSES. It never writes LICENSE or SECURITY.md without the maintainer
explicitly selecting an option (or confirming the mechanical declared-vs-file fix).
Keep the advisory output short.
