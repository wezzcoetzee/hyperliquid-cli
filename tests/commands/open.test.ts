import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockOrder, mockGetAssetIndex, mockGetRealCoinName, mockGetMidPrice, mockSetCoinState } = vi.hoisted(() => ({
  mockOrder: vi.fn(async () => ({
    response: { data: { statuses: [{ filled: { avgPx: "50100.5", totalSz: "0.1" } }] } },
  })),
  mockGetAssetIndex: vi.fn(async () => 0),
  mockGetRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
  mockGetMidPrice: vi.fn(async () => 50000),
  mockSetCoinState: vi.fn(() => {}),
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ order: mockOrder }),
  getAssetIndex: mockGetAssetIndex,
  getRealCoinName: mockGetRealCoinName,
  getMidPrice: mockGetMidPrice,
  getWalletAddress: () => "0xabc",
  getInfo: () => ({}),
}));

vi.mock("../../src/lib/state.js", () => ({
  setCoinState: mockSetCoinState,
  getCoinState: vi.fn(() => null),
  updateCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { openCommand } = await import("../../src/commands/open.js");

describe("openCommand", () => {
  beforeEach(() => {
    mockOrder.mockClear();
    mockSetCoinState.mockClear();
  });

  test("returns filled status with price and size on success", async () => {
    const result = await openCommand.run({ args: { side: "long", size: 0.1, coin: "BTC" } });
    expect(result).toMatchObject({
      status: "filled",
      coin: "BTC",
      side: "long",
      size: 0.1,
      avgPrice: "50100.5",
      totalSize: "0.1",
    });
  });

  test("saves coin state after successful fill", async () => {
    await openCommand.run({ args: { side: "long", size: 0.1, coin: "BTC" } });
    expect(mockSetCoinState).toHaveBeenCalledTimes(1);
    const [coin, state] = mockSetCoinState.mock.calls[0] as [string, unknown];
    expect(coin).toBe("BTC");
    expect(state).toMatchObject({ direction: "LONG", size: 0.1, slOid: null, tpOids: [] });
  });

  test("long uses buy=true with +3% slippage price", async () => {
    await openCommand.run({ args: { side: "long", size: 1, coin: "BTC" } });
    const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ b: boolean; p: string }> };
    expect(orderArg.orders[0].b).toBe(true);
    expect(parseFloat(orderArg.orders[0].p)).toBeCloseTo(50000 * 1.03, 0);
  });

  test("short uses buy=false with -3% slippage price", async () => {
    mockOrder.mockImplementationOnce(async () => ({
      response: { data: { statuses: [{ filled: { avgPx: "49000", totalSz: "1" } }] } },
    }));
    await openCommand.run({ args: { side: "short", size: 1, coin: "BTC" } });
    const orderArg = mockOrder.mock.calls[0][0] as { orders: Array<{ b: boolean; p: string }> };
    expect(orderArg.orders[0].b).toBe(false);
    expect(parseFloat(orderArg.orders[0].p)).toBeCloseTo(50000 * 0.97, 0);
  });

  test("returns error status on error response", async () => {
    mockOrder.mockImplementationOnce(async () => ({
      response: { data: { statuses: [{ error: "Insufficient margin" }] } },
    }));
    const result = await openCommand.run({ args: { side: "long", size: 100, coin: "BTC" } });
    expect(result).toEqual({ status: "error", error: "Insufficient margin" });
  });

  test("returns unknown status for unrecognized response", async () => {
    mockOrder.mockImplementationOnce(async () => ({
      response: { data: { statuses: ["someString"] } },
    }));
    const result = await openCommand.run({ args: { side: "long", size: 1, coin: "BTC" } });
    expect(result).toMatchObject({ status: "unknown" });
  });

  test("coin symbol is uppercased", async () => {
    const result = await openCommand.run({ args: { side: "long", size: 0.1, coin: "btc" } });
    expect((result as { coin: string }).coin).toBe("BTC");
  });
});
