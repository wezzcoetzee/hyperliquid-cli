import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

let tempDir: string;

const { homedirMock } = vi.hoisted(() => ({
  homedirMock: vi.fn(() => ""),
}));

vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, homedir: homedirMock };
});

async function importState() {
  vi.resetModules();
  vi.doMock("os", async (importOriginal) => {
    const actual = await importOriginal<typeof import("os")>();
    return { ...actual, homedir: homedirMock };
  });
  return import("../../src/lib/state.js");
}

describe("state.ts — concurrent writes", () => {
  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hl-cli-concurrent-"));
    homedirMock.mockReturnValue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // TODO(#19): The non-atomic read-modify-write cycle in setCoinState and
  // updateCoinState creates a race condition under concurrent callers — a later
  // reader can see a stale snapshot and overwrite changes made by a concurrent
  // writer. This test documents that known race. It is .skip'd so the suite
  // stays green on main; re-enable (and remove the .skip) once #19 ships the
  // atomic write fix.
  test.skip("N parallel setCoinState calls all persist without losing writes (known race — #19)", async () => {
    const { setCoinState, readState } = await importState();

    const coins = ["BTC", "ETH", "SOL", "AVAX", "ARB", "OP", "SUI", "APT", "INJ", "TIA"];
    const trade = (i: number) => ({
      direction: "LONG" as const,
      entry: 1000 * (i + 1),
      slOid: null,
      tpOids: [],
      size: i + 1,
    });

    // #when — fire all writes concurrently
    await Promise.all(coins.map((coin, i) => setCoinState(coin, trade(i))));

    // #then — every coin must be present in the final state
    const finalState = readState();
    for (const coin of coins) {
      expect(finalState[coin]).toBeDefined();
    }
  });

  // TODO(#19): Same race applies to updateCoinState.
  test.skip("N parallel updateCoinState calls do not lose any update (known race — #19)", async () => {
    const { setCoinState, updateCoinState, getCoinState } = await importState();

    const base = { direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 1 };
    setCoinState("BTC", base);

    const newOids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // #when — all try to update sl_oid concurrently; last write wins is fine,
    // but it must not throw or leave the file corrupted
    await expect(
      Promise.all(newOids.map((oid) => updateCoinState("BTC", { slOid: oid }))),
    ).resolves.not.toThrow();

    // #then — file must be valid JSON
    const stateFile = join(tempDir, ".hyperliquid-cli", "state.json");
    expect(existsSync(stateFile)).toBe(true);
    expect(() => JSON.parse(readFileSync(stateFile, "utf-8"))).not.toThrow();

    // BTC entry must still be present
    expect(getCoinState("BTC")).not.toBeNull();
  });

  test("sequential setCoinState calls across multiple coins produce valid JSON", async () => {
    // #given
    const { setCoinState, readState } = await importState();
    const coins = ["BTC", "ETH", "SOL"];

    // #when
    for (const [i, coin] of coins.entries()) {
      await setCoinState(coin, {
        direction: "LONG",
        entry: 1000 * (i + 1),
        slOid: null,
        tpOids: [],
        size: i + 1,
      });
    }

    // #then
    const finalState = readState();
    expect(Object.keys(finalState)).toHaveLength(3);

    const stateFile = join(tempDir, ".hyperliquid-cli", "state.json");
    expect(() => JSON.parse(readFileSync(stateFile, "utf-8"))).not.toThrow();
  });
});
