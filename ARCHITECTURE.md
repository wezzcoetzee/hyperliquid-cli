# Architecture

## System overview

Hyperliquid trading executor that exposes perpetual futures operations as both CLI commands and HTTP endpoints. Built on the incur framework, which provides a unified router for both modes. A single wallet private key authenticates all operations against the Hyperliquid L1.

## Tech stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Bun | TypeScript runtime and test runner |
| Framework | [incur](https://github.com/wevm/incur) | Dual CLI/HTTP router with Zod validation |
| Exchange SDK | [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid) | Hyperliquid L1 API client |
| Wallet | [viem](https://viem.sh) | Private key → account, signing |
| Deployment | Docker + GitHub Actions | Self-hosted homeserver with private registry |

## High-level diagram

```
User
 ├─ CLI args ─→ incur CLI router ─→ Command handler ─→ Hyperliquid L1 API
 └─ HTTP req ─→ incur HTTP router ─→ Command handler ─→ Hyperliquid L1 API
                                          │
                                          ├─→ ExchangeClient (orders, leverage)
                                          ├─→ InfoClient (positions, balances)
                                          └─→ State file (~/.hyperliquid-cli/state.json)
```

## Directory structure

```
src/
├── index.ts              # Entry point — registers commands, starts CLI or HTTP server
├── lib/
│   ├── client.ts         # Hyperliquid client setup (wallet, transport, asset cache)
│   └── state.ts          # File-based trade state persistence
└── commands/
    ├── open.ts           # Open position at market with slippage
    ├── close.ts          # Cancel orders + market close (reduce-only)
    ├── stop-loss.ts      # Trigger stop-loss order
    ├── take-profit.ts    # Trigger take-profit order
    ├── move-sl.ts        # Cancel existing SL, place at new price
    ├── cancel-all.ts     # Cancel all open orders for a coin
    ├── set-leverage.ts   # Set cross-margin leverage
    ├── positions.ts      # Query open positions
    ├── balance.ts        # Query account balance
    └── orders.ts         # Query open orders
tests/
├── lib/
│   └── state.test.ts     # State management unit tests
└── commands/
    └── *.test.ts         # Command tests with mocked clients
```

## Key architectural decisions

### Dual-mode execution (CLI + HTTP)
- **Context**: Need both interactive CLI usage and remote HTTP access for automation
- **Decision**: Use incur framework which provides a single command definition that works as both CLI and HTTP
- **Alternatives considered**: Separate CLI and HTTP implementations — rejected due to duplication
- **Consequences**: Command args must be serializable as URL path segments

### File-based state persistence
- **Context**: Need to track SL/TP order IDs across commands (e.g., `move-sl` needs to cancel existing SL)
- **Decision**: JSON file at `~/.hyperliquid-cli/state.json`
- **Alternatives considered**: SQLite — overkill for simple key-value state; in-memory — lost on restart
- **Consequences**: State is per-machine, not synced. Docker deployments mount a volume for persistence

### Market orders with slippage
- **Context**: Hyperliquid requires limit prices even for "market" orders
- **Decision**: Use `FrontendMarket` TIF with 3% slippage from mid price
- **Consequences**: Orders may partially fill; extreme volatility could exceed slippage tolerance

## Data flow

### Opening a position
1. User runs `open long 0.5 ETH`
2. `getAssetIndex("ETH")` resolves coin name to Hyperliquid asset index (cached after first call)
3. `getMidPrice("ETH")` fetches current mid price
4. Slippage price calculated: buy = mid * 1.03, sell = mid * 0.97
5. `exchange.order()` submits limit order with `FrontendMarket` TIF
6. On fill: `setCoinState("ETH", { direction, entry, size, sl_oid: null, tp_oids: [] })`

### Moving a stop-loss
1. Read existing SL order ID from state (or find SL orders via API fallback)
2. Cancel existing SL order
3. Read position direction/size from state (or API fallback)
4. Place new trigger SL order at new price
5. Update state with new `sl_oid`

## Environment and deployment

### Environment variables
| Variable | Required | Description |
|----------|----------|-------------|
| `HYPERLIQUID_PRIVATE_KEY` | Yes | Hex private key with 0x prefix |
| `PORT` | No | Set to enable HTTP mode (omit for CLI) |

### Deployment
- GitHub Actions workflow on push to `main` + manual dispatch
- Quality gate: `bun run lint` + `bun test` must pass before deploy
- Builds Docker image → pushes to private registry at `192.168.1.239:5000`
- Deploys container with restart policy, memory limit (128MB), app-network
- State persisted via Docker volume `hyperliquid-cli-state` mounted at `/root/.hyperliquid-cli`
- Rollback: previous `latest` tagged as `rollback` before deploy

See [RELIABILITY.md](docs/RELIABILITY.md) for health checks and recovery.

## Cross-references
- Security model: [docs/SECURITY.md](docs/SECURITY.md)
- Reliability: [docs/RELIABILITY.md](docs/RELIABILITY.md)
- Design decisions: [docs/design-docs/](docs/design-docs/)
