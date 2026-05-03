import { describe, test, expect, vi, beforeEach } from "vitest";

// Tests for move-sl failure rollback behavior.
//
// Current behavior (post-#17, post-#42):
//   placeTrigger runs first; the existing SL is only cancelled after the new
//   one is confirmed live. If placeTrigger fails, the old SL stays active and
//   no state update occurs.

const {
  mockPlaceTrigger,
  mockCancel,
  mockGetAssetIndex,
  mockGetRealCoinName,
  mockGetCoinState,
  mockUpdateCoinState,
} = vi.hoisted(() => ({
  mockPlaceTrigger: vi.fn(async () => ({ resting: { oid: 99 } })),
  mockCancel: vi.fn(async () => ({})),
  mockGetAssetIndex: vi.fn(async () => 0),
  mockGetRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
  mockGetCoinState: vi.fn(() => ({
    direction: "LONG" as const,
    entry: 50000,
    slOid: 55,
    tpOids: [],
    size: 0.1,
  })),
  mockUpdateCoinState: vi.fn(() => {}),
}));

vi.mock("../../src/lib/triggers.js", () => ({
  placeTrigger: mockPlaceTrigger,
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ order: vi.fn(), cancel: mockCancel }),
  getInfo: () => ({
    frontendOpenOrders: vi.fn(async () => []),
    clearinghouseState: vi.fn(async () => ({ assetPositions: [] })),
  }),
  getAssetIndex: mockGetAssetIndex,
  getRealCoinName: mockGetRealCoinName,
  getMidPrice: vi.fn(async () => 50000),
  getWalletAddress: () => "0xabc",
}));

vi.mock("../../src/lib/state.js", () => ({
  getCoinState: mockGetCoinState,
  updateCoinState: mockUpdateCoinState,
  setCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { moveSlCommand } = await import("../../src/commands/move-sl.js");

describe("moveSlCommand — placement failure rollback", () => {
  beforeEach(() => {
    mockPlaceTrigger.mockClear();
    mockCancel.mockClear();
    mockUpdateCoinState.mockClear();
    mockGetCoinState.mockClear();
  });

  test("placement runs before any cancel attempt", async () => {
    // #given
    const callOrder: string[] = [];
    mockPlaceTrigger.mockImplementationOnce(async () => {
      callOrder.push("place");
      return { resting: { oid: 99 } };
    });
    mockCancel.mockImplementationOnce(async () => {
      callOrder.push("cancel");
      return {};
    });

    // #when
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });

    // #then
    expect(callOrder).toEqual(["place", "cancel"]);
  });

  test("placement rejection propagates to caller", async () => {
    // #given
    mockPlaceTrigger.mockRejectedValueOnce(new Error("placement rejected"));

    // #when / #then
    await expect(
      moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } }),
    ).rejects.toThrow("placement rejected");
  });

  test("placement rejection leaves old SL untouched and state unchanged", async () => {
    // #given
    mockPlaceTrigger.mockRejectedValueOnce(new Error("rejected"));

    // #when
    await moveSlCommand
      .run({ args: { coin: "BTC", newPrice: 46000 } })
      .catch(() => {});

    // #then
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockUpdateCoinState).not.toHaveBeenCalled();
  });

  test("happy path still resolves correctly", async () => {
    // #when
    const result = await moveSlCommand.run({
      args: { coin: "BTC", newPrice: 46000 },
    });

    // #then
    expect(mockPlaceTrigger).toHaveBeenCalledOnce();
    expect(mockCancel).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ status: "moved", oid: 99 });
  });
});
