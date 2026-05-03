import { describe, test, expect, vi, beforeEach } from "vitest";

const {
  mockOrder,
  mockCancel,
  mockFrontendOpenOrders,
  mockClearinghouseState,
  mockGetAssetIndex,
  mockGetRealCoinName,
  mockGetMidPrice,
  mockRemoveCoinState,
} = vi.hoisted(() => ({
  mockOrder: vi.fn(async () => ({
    response: { data: { statuses: [{ filled: { avgPx: "49000", totalSz: "0.1" } }] } },
  })),
  mockCancel: vi.fn(async () => ({})),
  mockFrontendOpenOrders: vi.fn(async () => []),
  mockClearinghouseState: vi.fn(async () => ({
    assetPositions: [
      { position: { coin: "BTC", szi: "0.1", entryPx: "50000", positionValue: "5000", unrealizedPnl: "100", returnOnEquity: "0.02", liquidationPx: "40000", leverage: { value: 5 }, marginUsed: "1000" } },
    ],
  })),
  mockGetAssetIndex: vi.fn(async () => 0),
  mockGetRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
  mockGetMidPrice: vi.fn(async () => 50000),
  mockRemoveCoinState: vi.fn(() => {}),
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ order: mockOrder, cancel: mockCancel }),
  getInfo: () => ({ frontendOpenOrders: mockFrontendOpenOrders, clearinghouseState: mockClearinghouseState }),
  getAssetIndex: mockGetAssetIndex,
  getRealCoinName: mockGetRealCoinName,
  getMidPrice: mockGetMidPrice,
  getWalletAddress: () => "0xabc",
}));

vi.mock("../../src/lib/state.js", () => ({
  removeCoinState: mockRemoveCoinState,
  setCoinState: vi.fn(() => {}),
  getCoinState: vi.fn(() => null),
  updateCoinState: vi.fn(() => {}),
}));

const { closeCommand } = await import("../../src/commands/close.js");

describe("closeCommand", () => {
  beforeEach(() => {
    mockOrder.mockClear();
    mockCancel.mockClear();
    mockRemoveCoinState.mockClear();
    mockFrontendOpenOrders.mockClear();
    mockClearinghouseState.mockClear();
  });

  test("closes open long position and returns closed status", async () => {
    const result = await closeCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "closed", coin: "BTC", avgPrice: "49000", closedSize: "0.1" });
  });

  test("cancels existing orders before closing", async () => {
    mockFrontendOpenOrders.mockImplementationOnce(async () => [
      { coin: "BTC", oid: 123, orderType: "Limit", side: "B", limitPx: "51000", sz: "0.1", origSz: "0.1", reduceOnly: false, isTrigger: false, triggerPx: null, triggerCondition: null, timestamp: Date.now() },
    ]);
    await closeCommand.run({ args: { coin: "BTC" } });
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  test("returns no-position message when position size is zero", async () => {
    mockClearinghouseState.mockImplementationOnce(async () => ({
      assetPositions: [
        { position: { coin: "BTC", szi: "0" } },
      ],
    }));
    const result = await closeCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "ok", message: "No open position to close" });
  });

  test("returns no-position message when coin has no position entry", async () => {
    mockClearinghouseState.mockImplementationOnce(async () => ({
      assetPositions: [],
    }));
    const result = await closeCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "ok", message: "No open position to close" });
  });

  test("removes coin state after close", async () => {
    await closeCommand.run({ args: { coin: "BTC" } });
    expect(mockRemoveCoinState).toHaveBeenCalledWith("BTC");
  });

  test("uses reduce-only market order to close", async () => {
    await closeCommand.run({ args: { coin: "BTC" } });
    const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ r: boolean; t: unknown }> };
    expect(orderArg.orders[0].r).toBe(true);
    expect(orderArg.orders[0].t).toMatchObject({ limit: { tif: "FrontendMarket" } });
  });

  test("short position closes with buy=true", async () => {
    mockClearinghouseState.mockImplementationOnce(async () => ({
      assetPositions: [
        { position: { coin: "ETH", szi: "-2", entryPx: "3000", positionValue: "6000", unrealizedPnl: "-100", returnOnEquity: "-0.01", liquidationPx: "4000", leverage: { value: 3 }, marginUsed: "2000" } },
      ],
    }));
    await closeCommand.run({ args: { coin: "ETH" } });
    const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ b: boolean }> };
    expect(orderArg.orders[0].b).toBe(true);
  });

  test("returns error status on order error response", async () => {
    mockOrder.mockImplementationOnce(async () => ({
      response: { data: { statuses: [{ error: "Order rejected" }] } },
    }));
    const result = await closeCommand.run({ args: { coin: "BTC" } });
    expect(result).toMatchObject({ status: "error", error: "Order rejected" });
  });

  test("does not remove coin state when order returns an error", async () => {
    mockOrder.mockImplementationOnce(async () => ({
      response: { data: { statuses: [{ error: "Order rejected" }] } },
    }));
    await closeCommand.run({ args: { coin: "BTC" } });
    expect(mockRemoveCoinState).not.toHaveBeenCalled();
  });

  describe("partial close", () => {
    test("closes only the specified size", async () => {
      const result = await closeCommand.run({ args: { coin: "BTC", size: 0.05 } });
      const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ s: string }> };
      expect(orderArg.orders[0].s).toBe("0.05");
      expect(result).toMatchObject({ status: "partially_closed", coin: "BTC" });
    });

    test("does not cancel existing orders on partial close", async () => {
      mockFrontendOpenOrders.mockImplementationOnce(async () => [
        { coin: "BTC", oid: 123, orderType: "Limit", side: "B", limitPx: "51000", sz: "0.1", origSz: "0.1", reduceOnly: true, isTrigger: true, triggerPx: "48000", triggerCondition: null, timestamp: Date.now() },
      ]);
      const result = await closeCommand.run({ args: { coin: "BTC", size: 0.05 } });
      expect(mockCancel).not.toHaveBeenCalled();
      expect(result).toMatchObject({ status: "partially_closed", cancelledOrders: 0 });
    });

    test("does not remove coin state on partial close", async () => {
      await closeCommand.run({ args: { coin: "BTC", size: 0.05 } });
      expect(mockRemoveCoinState).not.toHaveBeenCalled();
    });

    test("returns error when requested size exceeds position size", async () => {
      const result = await closeCommand.run({ args: { coin: "BTC", size: 0.5 } });
      expect(result).toMatchObject({ status: "error", error: "Requested size 0.5 exceeds position size 0.1" });
      expect(mockOrder).not.toHaveBeenCalled();
    });

    test("uses reduce-only market order for partial close", async () => {
      await closeCommand.run({ args: { coin: "BTC", size: 0.05 } });
      const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ r: boolean; t: unknown }> };
      expect(orderArg.orders[0].r).toBe(true);
      expect(orderArg.orders[0].t).toMatchObject({ limit: { tif: "FrontendMarket" } });
    });

    test("partial close on short position closes with buy=true", async () => {
      mockClearinghouseState.mockImplementationOnce(async () => ({
        assetPositions: [
          { position: { coin: "ETH", szi: "-2", entryPx: "3000", positionValue: "6000", unrealizedPnl: "-100", returnOnEquity: "-0.01", liquidationPx: "4000", leverage: { value: 3 }, marginUsed: "2000" } },
        ],
      }));
      await closeCommand.run({ args: { coin: "ETH", size: 1 } });
      const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ b: boolean; s: string }> };
      expect(orderArg.orders[0].b).toBe(true);
      expect(orderArg.orders[0].s).toBe("1");
    });
  });
});
