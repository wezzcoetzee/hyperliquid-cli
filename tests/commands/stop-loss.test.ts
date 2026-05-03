import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockPlaceTrigger, mockGetAssetIndex, mockGetRealCoinName, mockGetCoinState, mockUpdateCoinState } = vi.hoisted(() => ({
  mockPlaceTrigger: vi.fn(async () => ({ resting: { oid: 77 } })),
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

const { stopLossCommand } = await import("../../src/commands/stop-loss.js");

describe("stopLossCommand", () => {
  beforeEach(() => {
    mockPlaceTrigger.mockClear();
    mockUpdateCoinState.mockClear();
  });

  test("returns placed status with oid on resting order", async () => {
    const result = await stopLossCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 },
    });
    expect(result).toMatchObject({ status: "placed", coin: "BTC", type: "stop-loss", oid: 77, triggerPrice: 45000 });
  });

  test("long SL passes LONG direction to placeTrigger", async () => {
    await stopLossCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "LONG", kind: "sl" }));
  });

  test("short SL passes SHORT direction to placeTrigger", async () => {
    await stopLossCommand.run({ args: { side: "short", size: 0.1, coin: "BTC", triggerPrice: 55000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ direction: "SHORT", kind: "sl" }));
  });

  test("passes correct triggerPrice and size to placeTrigger", async () => {
    await stopLossCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 } });
    expect(mockPlaceTrigger).toHaveBeenCalledWith(expect.objectContaining({ size: 0.1, triggerPrice: 45000 }));
  });

  test("updates coin state slOid when coin state exists", async () => {
    await stopLossCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 } });
    expect(mockUpdateCoinState).toHaveBeenCalledWith("BTC", { slOid: 77 });
  });

  test("does not update state when no coin state exists", async () => {
    mockGetCoinState.mockImplementationOnce(() => null);
    await stopLossCommand.run({ args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 } });
    expect(mockUpdateCoinState).not.toHaveBeenCalled();
  });

  test("returns placed status for waitingForTrigger response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => "waitingForTrigger");
    const result = await stopLossCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 },
    });
    expect(result).toMatchObject({ status: "placed" });
  });

  test("returns error status on error response", async () => {
    mockPlaceTrigger.mockImplementationOnce(async () => ({ error: "Order rejected" }));
    const result = await stopLossCommand.run({
      args: { side: "long", size: 0.1, coin: "BTC", triggerPrice: 45000 },
    });
    expect(result).toMatchObject({ status: "error", error: "Order rejected" });
  });
});
