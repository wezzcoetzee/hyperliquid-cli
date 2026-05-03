import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

const { homedirMock } = vi.hoisted(() => ({
  homedirMock: vi.fn(() => ""),
}));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return {
    ...actual,
    homedir: homedirMock,
  };
});

async function importState() {
  vi.resetModules();
  vi.doMock("os", async (importOriginal) => {
    const actual = await importOriginal<typeof import("os")>();
    return {
      ...actual,
      homedir: homedirMock,
    };
  });
  const mod = await import("../../src/lib/state.js");
  return mod;
}

describe("state.ts", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hl-cli-test-"));
    homedirMock.mockReturnValue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("readState", () => {
    test("returns empty object when state file does not exist", async () => {
      const { readState } = await importState();
      expect(readState()).toEqual({});
    });

    test("deserializes snake_case on-disk format to camelCase in memory", async () => {
      const stateDir = join(tempDir, ".hyperliquid-cli");
      mkdirSync(stateDir, { recursive: true });
      const stateFile = join(stateDir, "state.json");
      writeFileSync(stateFile, JSON.stringify({
        BTC: { direction: "LONG", entry: 50000, sl_oid: null, tp_oids: [], size: 0.1 },
      }));

      const { readState } = await importState();
      expect(readState()).toEqual({
        BTC: { direction: "LONG", entry: 50000, slOid: null, tpOids: [], size: 0.1 },
      });
    });
  });

  describe("writeState", () => {
    test("persists state in snake_case on disk", async () => {
      const { writeState } = await importState();
      const state = {
        ETH: { direction: "SHORT" as const, entry: 3000, slOid: 42, tpOids: [1, 2], size: 1.5 },
      };
      writeState(state);

      const stateDir = join(tempDir, ".hyperliquid-cli");
      const raw = JSON.parse(readFileSync(join(stateDir, "state.json"), "utf-8"));
      expect(raw).toEqual({
        ETH: { direction: "SHORT", entry: 3000, sl_oid: 42, tp_oids: [1, 2], size: 1.5 },
      });
    });

    test("round-trips camelCase through write and read", async () => {
      const { writeState, readState } = await importState();
      const state = {
        ETH: { direction: "SHORT" as const, entry: 3000, slOid: 42, tpOids: [1, 2], size: 1.5 },
      };
      writeState(state);
      expect(readState()).toEqual(state);
    });

    test("creates directory if it does not exist", async () => {
      const { writeState, readState } = await importState();
      writeState({});
      expect(readState()).toEqual({});
    });
  });

  describe("getCoinState", () => {
    test("returns null for missing coin", async () => {
      const { getCoinState } = await importState();
      expect(getCoinState("BTC")).toBeNull();
    });

    test("returns state for existing coin", async () => {
      const { setCoinState, getCoinState } = await importState();
      const trade = { direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 0.1 };
      await setCoinState("BTC", trade);
      expect(getCoinState("BTC")).toEqual(trade);
    });

    test("lookup is case-insensitive", async () => {
      const { setCoinState, getCoinState } = await importState();
      const trade = { direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 0.1 };
      await setCoinState("btc", trade);
      expect(getCoinState("BTC")).toEqual(trade);
      expect(getCoinState("btc")).toEqual(trade);
    });
  });

  describe("setCoinState", () => {
    test("stores state with uppercase key", async () => {
      const { setCoinState, readState } = await importState();
      const trade = { direction: "SHORT" as const, entry: 3000, slOid: null, tpOids: [], size: 2 };
      await setCoinState("eth", trade);
      const raw = readState();
      expect(raw["ETH"]).toEqual(trade);
      expect(raw["eth"]).toBeUndefined();
    });

    test("overwrites existing state for coin", async () => {
      const { setCoinState, getCoinState } = await importState();
      const first = { direction: "LONG" as const, entry: 100, slOid: null, tpOids: [], size: 1 };
      const second = { direction: "SHORT" as const, entry: 200, slOid: 5, tpOids: [3], size: 2 };
      await setCoinState("SOL", first);
      await setCoinState("SOL", second);
      expect(getCoinState("SOL")).toEqual(second);
    });
  });

  describe("updateCoinState", () => {
    test("merges partial updates into existing state", async () => {
      const { setCoinState, updateCoinState, getCoinState } = await importState();
      const trade = { direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 0.1 };
      await setCoinState("BTC", trade);
      await updateCoinState("BTC", { slOid: 99 });
      expect(getCoinState("BTC")).toEqual({ ...trade, slOid: 99 });
    });

    test("throws when coin does not exist", async () => {
      const { updateCoinState } = await importState();
      await expect(updateCoinState("MISSING", { slOid: 1 })).rejects.toThrow("No state found for MISSING");
    });
  });

  describe("removeCoinState", () => {
    test("deletes coin entry from state", async () => {
      const { setCoinState, removeCoinState, getCoinState } = await importState();
      const trade = { direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 0.1 };
      await setCoinState("BTC", trade);
      await removeCoinState("BTC");
      expect(getCoinState("BTC")).toBeNull();
    });

    test("does not throw when coin does not exist", async () => {
      const { removeCoinState } = await importState();
      await expect(removeCoinState("NONEXISTENT")).resolves.not.toThrow();
    });
  });

  describe("tmp file cleanup", () => {
    test("removes stale .tmp file left from a previous crash on readState", async () => {
      // #given
      const stateDir = join(tempDir, ".hyperliquid-cli");
      mkdirSync(stateDir, { recursive: true });
      const tmpFile = join(stateDir, "state.json.tmp");
      writeFileSync(tmpFile, '{"STALE": true}');

      // #when
      const { readState } = await importState();
      readState();

      // #then
      expect(existsSync(tmpFile)).toBe(false);
    });
  });
});
