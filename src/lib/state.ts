import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const STATE_DIR = join(homedir(), ".hyperliquid-cli");
const STATE_FILE = join(STATE_DIR, "state.json");
const STATE_TMP = `${STATE_FILE}.tmp`;

export interface TradeState {
  direction: "LONG" | "SHORT";
  entry: number;
  slOid: number | null;
  tpOids: number[];
  size: number;
}

type StateMap = Record<string, TradeState>;

interface PersistedTradeState {
  direction: "LONG" | "SHORT";
  entry: number;
  sl_oid: number | null;
  tp_oids: number[];
  size: number;
}

type PersistedStateMap = Record<string, PersistedTradeState>;

function deserialize(persisted: PersistedTradeState): TradeState {
  return {
    direction: persisted.direction,
    entry: persisted.entry,
    slOid: persisted.sl_oid,
    tpOids: persisted.tp_oids,
    size: persisted.size,
  };
}

function serialize(trade: TradeState): PersistedTradeState {
  return {
    direction: trade.direction,
    entry: trade.entry,
    sl_oid: trade.slOid,
    tp_oids: trade.tpOids,
    size: trade.size,
  };
}

let mutex: Promise<void> = Promise.resolve();

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

function cleanupTmp(): void {
  if (existsSync(STATE_TMP)) {
    rmSync(STATE_TMP);
  }
}

export function readState(): StateMap {
  ensureDir();
  cleanupTmp();
  if (!existsSync(STATE_FILE)) {
    return {};
  }
  const raw = readFileSync(STATE_FILE, "utf-8");
  const persisted = JSON.parse(raw) as PersistedStateMap;
  return Object.fromEntries(
    Object.entries(persisted).map(([key, value]) => [key, deserialize(value)])
  );
}

export function writeState(state: StateMap): void {
  ensureDir();
  const persisted: PersistedStateMap = Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, serialize(value)])
  );
  writeFileSync(STATE_TMP, JSON.stringify(persisted, null, 2));
  renameSync(STATE_TMP, STATE_FILE);
}

export function getCoinState(coin: string): TradeState | null {
  const state = readState();
  return state[coin.toUpperCase()] ?? null;
}

function withMutex(fn: () => void): Promise<void> {
  const next = mutex.then(fn);
  mutex = next.catch(() => {});
  return next;
}

export function setCoinState(coin: string, trade: TradeState): Promise<void> {
  return withMutex(() => {
    const state = readState();
    state[coin.toUpperCase()] = trade;
    writeState(state);
  });
}

export function updateCoinState(coin: string, updates: Partial<TradeState>): Promise<void> {
  return withMutex(() => {
    const state = readState();
    const key = coin.toUpperCase();
    const existing = state[key];
    if (!existing) {
      throw new Error(`No state found for ${key}`);
    }
    state[key] = { ...existing, ...updates };
    writeState(state);
  });
}

export function removeCoinState(coin: string): Promise<void> {
  return withMutex(() => {
    const state = readState();
    delete state[coin.toUpperCase()];
    writeState(state);
  });
}
