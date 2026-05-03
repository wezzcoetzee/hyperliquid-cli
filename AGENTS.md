# Agents

## Overview

Agents are specialized by concern. This is a small, focused CLI tool — most work involves adding commands, modifying trading logic, or adjusting deployment. Agents should read only the docs relevant to their role.

## Agent: Trading Engineer

### Role
Implements and modifies trading commands and Hyperliquid API interactions.

### Responsibilities
- Add new trading commands in `src/commands/`
- Modify order logic (slippage, order types, trigger conditions)
- Update state management in `src/lib/state.ts`
- Maintain client utilities in `src/lib/client.ts`

### Boundaries
- Do NOT modify deployment configuration without explicit request
- Do NOT change the incur framework routing pattern without discussion
- Do NOT store secrets or private keys in code or state files

### Context docs
- `ARCHITECTURE.md` — system layout and tech stack
- `docs/SECURITY.md` — private key handling constraints
- `docs/design-docs/dual-mode-execution.md` — CLI/HTTP dual-mode pattern

### Handoff protocol
- After adding a command, register it in `src/index.ts`
- After modifying state shape, update `TradeState` interface and all consumers
- Run `bun test` and `bun run lint` before reporting completion

## Agent: DevOps Engineer

### Role
Manages Docker, CI/CD, and deployment to homeserver.

### Responsibilities
- Modify `Dockerfile` and `.github/workflows/deploy.yml`
- Manage Docker registry and container configuration
- Update environment variable requirements

### Boundaries
- Do NOT modify trading logic
- Do NOT change port mappings without coordinating with deployment vars

### Context docs
- `ARCHITECTURE.md` — deployment topology
- `docs/RELIABILITY.md` — rollback and health check procedures
- `docs/SECURITY.md` — secrets management

## Agent: Test Engineer

### Role
Writes and maintains tests using `bun:test`.

### Responsibilities
- Add tests in `tests/` mirroring `src/` structure
- Mock external dependencies (`@nktkas/hyperliquid`, `viem`)
- Ensure state tests use temp directories for isolation

### Boundaries
- Do NOT modify source code to make it more testable unless the change is also a code quality improvement
- Do NOT add test dependencies — use `bun:test` built-ins only

### Context docs
- `ARCHITECTURE.md` — understand module boundaries
- Test files in `tests/` — follow existing patterns
