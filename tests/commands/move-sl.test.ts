import { describe, test, expect, vi, beforeEach } from "vitest";

const {
  mockPlaceTrigger,
  mockCancel,
  mockFrontendOpenOrders,
  mockClearinghouseState,
  mockGetAssetIndex,
  mockGetRealCoinName,
  mockGetCoinState,
  mockUpdateCoinState,
} = vi.hoisted(() => ({
  mockPlaceTrigger: vi.fn(async () => ({ resting: { oid: 99 } })),
  mockCancel: vi.fn(async () => ({})),
  mockFrontendOpenOrders: vi.fn(async () => []),
  mockClearinghouseState: vi.fn(async () => ({
    assetPositions: [],
  })),
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
  getInfo: () => ({ frontendOpenOrders: mockFrontendOpenOrders, clearinghouseState: mockClearinghouseState }),
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

describe("moveSlCommand", () => {
  beforeEach(() => {
    mockPlaceTrigger.mockClear();
    mockCancel.mockClear();
    mockUpdateCoinState.mockClear();
    mockFrontendOpenOrders.mockClear();
    mockClearinghouseState.mockClear();
    mockGetCoinState.mockClear();
  });

  test("places new SL before cancelling the existing one", async () => {
    const callOrder: string[] = [];
    mockPlaceTrigger.mockImplementationOnce(async () => {
      callOrder.push("order");
      return { resting: { oid: 99 } };
    });
    mockCancel.mockImplementationOnce(async () => {
      callOrder.push("cancel");
      return {};
    });

    const result = await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });

    expect(callOrder).toEqual(["order", "cancel"]);
    expect(mockCancel).toHaveBeenCalledWith({ cancels: [{ a: 0, o: 55 }] });
    expect(result).toMatchObject({ status: "moved", coin: "BTC", newTriggerPrice: 46000, oid: 99 });
  });

  test("updates coin state with new slOid", async () => {
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(mockUpdateCoinState).toHaveBeenCalledWith("BTC", { slOid: 99 });
  });

  test("fallback: searches open orders for SL when no slOid in state", async () => {
    mockGetCoinState.mockImplementationOnce(() => ({
      direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [], size: 0.1,
    }));
    mockFrontendOpenOrders.mockImplementationOnce(async () => [
      { coin: "BTC", oid: 33, orderType: "Stop Market", side: "A", limitPx: "0", sz: "0.1", origSz: "0.1", reduceOnly: true, isTrigger: true, triggerPx: "45000", triggerCondition: "mark_price", timestamp: Date.now() },
    ]);
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(mockCancel).toHaveBeenCalledWith({ cancels: [{ a: 0, o: 33 }] });
  });

  test("falls back to clearinghouse position when no coin state", async () => {
    mockGetCoinState.mockImplementationOnce(() => null);
    mockClearinghouseState.mockImplementationOnce(async () => ({
      assetPositions: [
        { position: { coin: "BTC", szi: "0.5" } },
      ],
    }));
    const result = await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(result).toMatchObject({ status: "moved", direction: "LONG", size: 0.5 });
  });

  test("returns error when no coin state and no position", async () => {
    mockGetCoinState.mockImplementationOnce(() => null);
    mockClearinghouseState.mockImplementationOnce(async () => ({ assetPositions: [] }));
    const result = await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(result).toMatchObject({ status: "error" });
  });

  test("LONG position SL passes LONG direction to placeTrigger", async () => {
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "LONG", kind: "sl" }));
  });

  test("SHORT position SL passes SHORT direction to placeTrigger", async () => {
    mockGetCoinState.mockImplementationOnce(() => ({
      direction: "SHORT" as const, entry: 50000, slOid: 55, tpOids: [], size: 0.1,
    }));
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 55000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "SHORT", kind: "sl" }));
  });

  test("returns moved status for waitingForTrigger response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => "waitingForTrigger");
    const result = await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(result).toMatchObject({ status: "moved" });
  });

  test("returns error status on order error response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => ({ error: "Rejected" }));
    const result = await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(result).toMatchObject({ status: "error", error: "Rejected" });
  });

  test("does not cancel old SL or update state when placement fails", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => ({ error: "Insufficient margin" }));
    await moveSlCommand.run({ args: { coin: "BTC", newPrice: 46000 } });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockUpdateCoinState).not.toHaveBeenCalled();
  });
});
