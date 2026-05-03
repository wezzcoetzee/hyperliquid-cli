# @wezzcoetzee/hyperliquid-cli

A command-line trading executor for [Hyperliquid](https://hyperliquid.xyz) perps, designed for **agent use**. Every command supports machine-readable output (`--format json|yaml|toon|jsonl`), JSON Schema introspection (`--schema`), an LLM manifest (`--llms-full`), and can run as a native MCP server (`--mcp`) so coding/trading agents can drive it directly.

## What it can do

### Account & state

- `hl balance` — Get perpetual account balance (account value, margin used, withdrawable, total notional)
- `hl positions` — List open positions (size, entry, leverage, unrealized PnL, liquidation price)
- `hl orders` — List open orders (resting limits, triggers, reduce-only flags)

### Trading

- `hl open <side> <size> <coin>` — Open a position at market price (`side` = `long` | `short`)
- `hl close <coin> [size]` — Cancel all orders for the coin and close the position at market (reduce-only). Omit `size` for a full close.
- `hl set-leverage <coin> <leverage>` — Set leverage for a coin (cross margin)

### Risk management

- `hl stop-loss <side> <size> <coin> <triggerPrice>` — Place a trigger stop-loss (reduce-only)
- `hl take-profit <side> <size> <coin> <triggerPrice>` — Place a trigger take-profit (reduce-only)
- `hl move-sl <coin> <newPrice>` — Cancel the existing stop-loss for a coin and replace it at a new trigger price
- `hl cancel-all <coin>` — Cancel every open order for a coin

### Agent integration (built-in)

- `--mcp` — Run as an MCP stdio server; every command above becomes a tool
- `hl mcp add` — Register the CLI as an MCP server with your agent (Claude Code, Cursor, etc.)
- `hl skills add` — Sync skill files to your agent so it knows how to use the CLI
- `--llms` / `--llms-full` — Print an LLM-readable manifest of all commands
- `--schema` — Print the JSON Schema for any command's arguments and output
- `completions` — Generate a shell completion script

## Install

```bash
npm install -g @wezzcoetzee/hyperliquid-cli
```

This installs the `hl` binary on your `PATH`. Requires Node.js 18+.

## Setup

The CLI signs trades with your Hyperliquid wallet's private key, read from `HYPERLIQUID_PRIVATE_KEY`:

```bash
export HYPERLIQUID_PRIVATE_KEY=0x...
```

Or put it in a `.env` file in your working directory (a `.env.example` is in this repo for reference).

> **Security:** This key can move funds. Never commit it, never paste it into shared shells, and prefer a [dedicated Hyperliquid API wallet](https://app.hyperliquid.xyz/API) over your main account key.

Verify it's working:

```bash
hl balance
```

## Quick start

```bash
hl balance
hl positions
hl open long 0.01 BTC
hl stop-loss long 0.01 BTC 60000
hl take-profit long 0.01 BTC 80000
hl close BTC
```

## Using with an agent

### Option 1 — Register as an MCP server (recommended)

Once installed globally, register `hl` with your agent. It exposes every command as a tool.

```bash
hl mcp add                          # auto-detects installed agents, registers globally
hl mcp add --agent claude-code      # target a specific agent
hl mcp add --no-global              # install to current project instead of globally
```

The agent will see tools like `balance`, `positions`, `open`, `close`, `stop-loss`, etc., each with full JSON Schema for arguments and outputs. Make sure `HYPERLIQUID_PRIVATE_KEY` is exported in the environment the agent launches MCP servers from.

To run the MCP server manually (for custom integrations):

```bash
hl --mcp
```

### Option 2 — Shell out from the agent

Any agent that can run shell commands can use `hl` directly. Use `--format json` for parseable output:

```bash
hl positions --format json
hl balance --format json
hl open long 0.01 BTC --format json
```

For agents that need a compact menu of capabilities upfront, pipe `hl --llms-full` into the prompt — it's a complete machine-readable manifest of every command, argument, and output schema.

### Option 3 — Sync skill files

```bash
hl skills add
```

Writes guidance files into your agent's skills directory so it knows when and how to call each command.

## Output formats and filtering

Every command supports global flags:

| Flag | Description |
| --- | --- |
| `--format <toon\|json\|yaml\|md\|jsonl>` | Output format (default is human-readable) |
| `--filter-output <keys>` | Filter response by key paths (e.g. `--filter-output positions[0].coin,positions[0].szi`) |
| `--verbose` | Show full output envelope (timing, request id, etc.) |
| `--schema` | Print JSON Schema for the command's input/output |
| `--token-count` / `--token-limit <n>` / `--token-offset <n>` | Manage output size for LLM context windows |
| `--help` | Show help for the command |

Run `hl --help` to see all globals, or `hl <command> --help` for a specific command.

## Development

```bash
git clone https://github.com/wezzcoetzee/hyperliquid-cli.git
cd hyperliquid-cli
npm install
cp .env.example .env   # add your HYPERLIQUID_PRIVATE_KEY
npm run dev -- positions
npm test
npm run build
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`AGENTS.md`](./AGENTS.md) for project layout and contribution guidelines.

## License

MIT © Wesley Coetzee
