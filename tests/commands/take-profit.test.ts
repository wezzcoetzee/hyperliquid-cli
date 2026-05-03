import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockPlaceTrigger, mockGetAssetIndex, mockGetRealCoinName, mockGetCoinState, mockUpdateCoinState } = vi.hoisted(() => ({
  mockPlaceTrigger: vi.fn(async () => ({ resting: { oid: 88 } })),
  mockGetAssetIndex: vi.fn(async () => 0),
  mockGetRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
  mockGetCoinState: vi.fn(() => ({
    direction: "LONG" as const,
    entry: 50000,
    slOid: null,
    tpOids: [],
    size: 0.1,
  })),
  mockUpdateCoinState: vi.fn(() => {}),
}));

vi.mock("../../src/lib/triggers.js", () => ({
  placeTrigger: mockPlaceTrigger,
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ order: vi.fn() }),
  getAssetIndex: mockGetAssetIndex,
  getRealCoinName: mockGetRealCoinName,
  getMidPrice: vi.fn(async () => 50000),
  getWalletAddress: () => "0xabc",
  getInfo: () => ({}),
}));

vi.mock("../../src/lib/state.js", () => ({
  getCoinState: mockGetCoinState,
  updateCoinState: mockUpdateCoinState,
  setCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { takeProfitCommand } = await import("../../src/commands/take-profit.js");

describe("takeProfitCommand", () => {
  beforeEach(() => {
    mockPlaceTrigger.mockClear();
    mockUpdateCoinState.mockClear();
    mockGetCoinState.mockClear();
  });

  test("returns placed status with oid on resting order", async () => {
    const result = await takeProfitCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 },
    });
    expect(result).toMatchObject({ status: "placed", coin: "BTC", type: "take-profit", oid: 88, triggerPrice: 60000 });
  });

  test("long TP passes LONG direction to placeTrigger", async () => {
    await takeProfitCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "LONG", kind: "tp" }));
  });

  test("short TP passes SHORT direction to placeTrigger", async () => {
    await takeProfitCommand.run({ args: { side: "short", size: 0.1, coin: "BTC", triggerPrice: 40000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "SHORT", kind: "tp" }));
  });

  test("appends oid to tpOids in state on resting response", async () => {
    mockGetCoinState.mockImplementationOnce(() => ({
      direction: "LONG" as const, entry: 50000, slOid: null, tpOids: [11], size: 0.1,
    }));
    await takeProfitCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 } });
    expect(mockUpdateCoinState).toHaveBeenCalledWith("BTC", { tpOids: [11, 88] });
  });

  test("returns placed status for waitingForTrigger response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => "waitingForTrigger");
    const result = await takeProfitCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 },
    });
    expect(result).toMatchObject({ status: "placed", type: "take-profit" });
  });

  test("does not update state for waitingForTrigger response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => "waitingForTrigger");
    await takeProfitCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 } });
    expect(mockUpdateCoinState).not.toHaveBeenCalled();
  });

  test("does not update state when no coin state exists", async () => {
    mockGetCoinState.mockImplementationOnce(() => null);
    await takeProfitCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 } });
    expect(mockUpdateCoinState).not.toHaveBeenCalled();
  });

  test("returns error status on error response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => ({ error: "TP rejected" }));
    const result = await takeProfitCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 60000 },
    });
    expect(result).toMatchObject({ status: "error", error: "TP rejected" });
  });
});
