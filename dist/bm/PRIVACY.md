# Privacy Policy — GSD Plugin for Claude Code

**Last updated:** 2026-04-07

## Overview

The GSD (Get Shit Done) plugin for Claude Code is an open-source workflow tool that runs entirely on your local machine within the Claude Code environment.

## Data Collection

This plugin does **not** collect, transmit, store, or process any personal data. Specifically:

- **No telemetry** — no usage data, analytics, or metrics are sent anywhere
- **No network requests** — the plugin makes no outbound connections (except when you explicitly use commands that invoke GitHub CLI or web search tools you have configured)
- **No accounts** — no registration, login, or authentication is required
- **No cookies or tracking** — none
- **No third-party services** — no data is shared with any third party

## Local Storage

All plugin data (planning artifacts, state files, configuration) is stored locally in your project's `.planning/` directory and `~/.claude/` configuration directory. This data never leaves your machine unless you choose to commit it to a git repository.

## MCP Server

The plugin includes a local MCP server for project state management. This server runs locally and communicates only with the Claude Code process on your machine. It does not expose any network ports or accept remote connections.

## Open Source

This plugin is fully open source under the MIT license. You can inspect all code at: https://github.com/jnuyens/gsd-plugin

## Contact

For privacy questions or concerns, open an issue at: https://github.com/jnuyens/gsd-plugin/issues
