# @wezzcoetzee/hyperliquid-cli

A command-line trading executor for [Hyperliquid](https://hyperliquid.xyz) perps. Open and close positions, manage stop-loss / take-profit, set leverage, and inspect balances and orders — all from your terminal.

## Install

```bash
npm install -g @wezzcoetzee/hyperliquid-cli
```

This installs the `hl` binary on your `PATH`.

## Setup

The CLI signs trades with your Hyperliquid wallet's private key, read from `HYPERLIQUID_PRIVATE_KEY`:

```bash
export HYPERLIQUID_PRIVATE_KEY=0x...
```

> **Security:** This key can move funds. Never commit it, never paste it into shared shells, and prefer a dedicated API wallet over your main account key.

## Quick start

```bash
hl balance
hl positions
hl open long 0.01 BTC
hl stop-loss long 0.01 BTC 60000
hl close BTC
```

## Commands

| Command | Synopsis | Description |
|---|---|---|
| `hl balance` | — | Get perpetual account balance |
| `hl positions` | — | List open positions |
| `hl orders` | — | List open orders |
| `hl open <side> <size> <coin>` | `hl open long 0.01 BTC` | Open a position at market price |
| `hl close <coin> [size]` | `hl close BTC` | Cancel all orders and close position at market (reduce-only). Omit `size` for a full close. |
| `hl stop-loss <side> <size> <coin> <triggerPrice>` | `hl stop-loss long 0.01 BTC 60000` | Place a trigger stop-loss order (reduce-only) |
| `hl take-profit <side> <size> <coin> <triggerPrice>` | `hl take-profit long 0.01 BTC 80000` | Place a trigger take-profit order (reduce-only) |
| `hl move-sl <coin> <newPrice>` | `hl move-sl BTC 62000` | Cancel existing stop-loss and replace at a new price |
| `hl cancel-all <coin>` | `hl cancel-all BTC` | Cancel all open orders for a coin |
| `hl set-leverage <coin> <leverage>` | `hl set-leverage BTC 10` | Set leverage for a coin (cross margin) |

Run `hl <command> --help` for argument details, or `hl --help` for global options including output formatting (`--format json|yaml|toon|md|jsonl`).

## Development

```bash
git clone https://github.com/wezzcoetzee/hyperliquid-cli.git
cd hyperliquid-cli
npm install
npm run dev -- positions
npm test
npm run build
```

## License

MIT © Wesley Coetzee
