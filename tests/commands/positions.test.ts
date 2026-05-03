import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockClearinghouseState } = vi.hoisted(() => ({
  mockClearinghouseState: vi.fn(async () => ({
    assetPositions: [
      {
        position: {
          coin: "BTC",
          szi: "0.1",
          entryPx: "50000",
          positionValue: "5000",
          unrealizedPnl: "200",
          returnOnEquity: "0.04",
          liquidationPx: "40000",
          leverage: { value: 5 },
          marginUsed: "1000",
        },
      },
      {
        position: {
          coin: "ETH",
          szi: "-2",
          entryPx: "3000",
          positionValue: "6000",
          unrealizedPnl: "-100",
          returnOnEquity: "-0.02",
          liquidationPx: "4000",
          leverage: { value: 3 },
          marginUsed: "2000",
        },
      },
      {
        position: {
          coin: "SOL",
          szi: "0",
          entryPx: null,
          positionValue: "0",
          unrealizedPnl: "0",
          returnOnEquity: "0",
          liquidationPx: null,
          leverage: { value: 1 },
          marginUsed: "0",
        },
      },
    ],
  })),
}));

vi.mock("../../src/lib/client.js", () => ({
  getInfo: () => ({ clearinghouseState: mockClearinghouseState }),
  getWalletAddress: () => "0xabc",
  getExchange: () => ({}),
  getAssetIndex: vi.fn(async () => 0),
  getRealCoinName: vi.fn(async (coin: string) => coin.toUpperCase()),
  getMidPrice: vi.fn(async () => 0),
}));

vi.mock("../../src/lib/state.js", () => ({
  getCoinState: vi.fn(() => null),
  updateCoinState: vi.fn(() => {}),
  setCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { positionsCommand } = await import("../../src/commands/positions.js");

describe("positionsCommand", () => {
  beforeEach(() => {
    mockClearinghouseState.mockClear();
  });

  test("returns only non-zero positions", async () => {
    const result = await positionsCommand.run() as { count: number; positions: unknown[] };
    expect(result.count).toBe(2);
    expect(result.positions).toHaveLength(2);
  });

  test("maps LONG side for positive szi", async () => {
    const result = await positionsCommand.run() as { positions: Array<{ coin: string; side: string }> };
    const btc = result.positions.find((p) => p.coin === "BTC");
    expect(btc?.side).toBe("LONG");
  });

  test("maps SHORT side for negative szi", async () => {
    const result = await positionsCommand.run() as { positions: Array<{ coin: string; side: string }> };
    const eth = result.positions.find((p) => p.coin === "ETH");
    expect(eth?.side).toBe("SHORT");
  });

  test("includes all expected position fields", async () => {
    const result = await positionsCommand.run() as { positions: Array<Record<string, unknown>> };
    const btc = result.positions[0];
    expect(btc).toHaveProperty("coin");
    expect(btc).toHaveProperty("size");
    expect(btc).toHaveProperty("entryPrice");
    expect(btc).toHaveProperty("positionValue");
    expect(btc).toHaveProperty("unrealizedPnl");
    expect(btc).toHaveProperty("returnOnEquity");
    expect(btc).toHaveProperty("liquidationPrice");
    expect(btc).toHaveProperty("leverage");
    expect(btc).toHaveProperty("marginUsed");
  });

  test("returns count=0 and empty array when no positions", async () => {
    mockClearinghouseState.mockImplementationOnce(async () => ({ assetPositions: [] }));
    const result = await positionsCommand.run() as { count: number; positions: unknown[] };
    expect(result.count).toBe(0);
    expect(result.positions).toEqual([]);
  });
});
