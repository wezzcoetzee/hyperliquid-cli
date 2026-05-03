import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockCancel, mockFrontendOpenOrders, mockGetAssetIndex, mockGetRealCoinName } = vi.hoisted(() => ({
  mockCancel: vi.fn(async () => ({})),
  mockFrontendOpenOrders: vi.fn(async () => []),
  mockGetAssetIndex: vi.fn(async () => 0),
  mockGetRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ cancel: mockCancel }),
  getInfo: () => ({ frontendOpenOrders: mockFrontendOpenOrders }),
  getAssetIndex: mockGetAssetIndex,
  getRealCoinName: mockGetRealCoinName,
  getMidPrice: vi.fn(async () => 0),
  getWalletAddress: () => "0xabc",
}));

vi.mock("../../src/lib/state.js", () => ({
  getCoinState: vi.fn(() => null),
  updateCoinState: vi.fn(() => {}),
  setCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { cancelAllCommand } = await import("../../src/commands/cancel-all.js");

const makeOrder = (oid: number) => ({
  coin: "BTC",
  oid,
  orderType: "Limit",
  side: "B",
  limitPx: "50000",
  sz: "0.1",
  origSz: "0.1",
  reduceOnly: false,
  isTrigger: false,
  triggerPx: null,
  triggerCondition: null,
  timestamp: Date.now(),
});

describe("cancelAllCommand", () => {
  beforeEach(() => {
    mockCancel.mockClear();
    mockFrontendOpenOrders.mockClear();
  });

  test("returns cancelled=0 and no-op message when no orders exist", async () => {
    const result = await cancelAllCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "ok", coin: "BTC", cancelled: 0, message: "No open orders" });
    expect(mockCancel).not.toHaveBeenCalled();
  });

  test("cancels all orders for coin and returns count", async () => {
    mockFrontendOpenOrders.mockImplementationOnce(async () => [makeOrder(1), makeOrder(2)]);
    const result = await cancelAllCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "ok", coin: "BTC", cancelled: 2 });
    expect(mockCancel).toHaveBeenCalledWith({
      cancels: [{ a: 0, o: 1 }, { a: 0, o: 2 }],
    });
  });

  test("only cancels orders for the requested coin", async () => {
    mockFrontendOpenOrders.mockImplementationOnce(async () => [
      { ...makeOrder(1), coin: "BTC" },
      { ...makeOrder(2), coin: "ETH" },
    ]);
    const result = await cancelAllCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ cancelled: 1 });
    const cancelArg = mockCancel.mock.calls[0][0] as { cancels: Array<{ o: number }> };
    expect(cancelArg.cancels).toHaveLength(1);
    expect(cancelArg.cancels[0].o).toBe(1);
  });

  test("coin is uppercased in response", async () => {
    const result = await cancelAllCommand.run({ args: { coin: "btc" } });
    expect((result as { coin: string }).coin).toBe("BTC");
  });

  test("response includes order details when cancelling", async () => {
    mockFrontendOpenOrders.mockImplementationOnce(async () => [makeOrder(5)]);
    const result = await cancelAllCommand.run({ args: { coin: "BTC" } }) as {
      orders: Array<{ oid: number; type: string; side: string; price: string; size: string }>
    };
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({ oid: 5, type: "Limit", side: "B", price: "50000", size: "0.1" });
  });
});
