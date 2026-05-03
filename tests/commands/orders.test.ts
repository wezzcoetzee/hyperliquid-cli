import { describe, test, expect, vi } from "vitest";

const ts = 1700000000000;

const { mockFrontendOpenOrders } = vi.hoisted(() => ({
  mockFrontendOpenOrders: vi.fn(async () => [
    {
      coin: "BTC",
      oid: 101,
      side: "B",
      orderType: "Limit",
      limitPx: "50000",
      sz: "0.1",
      origSz: "0.1",
      reduceOnly: false,
      isTrigger: false,
      triggerPx: null,
      triggerCondition: null,
      timestamp: ts,
    },
    {
      coin: "ETH",
      oid: 202,
      side: "A",
      orderType: "Stop Market",
      limitPx: "2800",
      sz: "2",
      origSz: "2",
      reduceOnly: true,
      isTrigger: true,
      triggerPx: "2800",
      triggerCondition: "mark_price",
      timestamp: ts,
    },
  ]),
}));

vi.mock("../../src/lib/client.js", () => ({
  getInfo: () => ({ frontendOpenOrders: mockFrontendOpenOrders }),
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

const { ordersCommand } = await import("../../src/commands/orders.js");

describe("ordersCommand", () => {
  test("returns count and mapped orders", async () => {
    const result = await ordersCommand.run() as { count: number; orders: unknown[] };
    expect(result.count).toBe(2);
    expect(result.orders).toHaveLength(2);
  });

  test("maps buy side B to BUY", async () => {
    const result = await ordersCommand.run() as { orders: Array<{ side: string }> };
    expect(result.orders[0].side).toBe("BUY");
  });

  test("maps sell side A to SELL", async () => {
    const result = await ordersCommand.run() as { orders: Array<{ side: string }> };
    expect(result.orders[1].side).toBe("SELL");
  });

  test("converts timestamp to ISO string", async () => {
    const result = await ordersCommand.run() as { orders: Array<{ timestamp: string }> };
    expect(result.orders[0].timestamp).toBe(new Date(ts).toISOString());
  });

  test("includes all expected order fields", async () => {
    const result = await ordersCommand.run() as { orders: Array<Record<string, unknown>> };
    const order = result.orders[0];
    expect(order).toHaveProperty("coin");
    expect(order).toHaveProperty("oid");
    expect(order).toHaveProperty("side");
    expect(order).toHaveProperty("orderType");
    expect(order).toHaveProperty("price");
    expect(order).toHaveProperty("size");
    expect(order).toHaveProperty("originalSize");
    expect(order).toHaveProperty("reduceOnly");
    expect(order).toHaveProperty("isTrigger");
    expect(order).toHaveProperty("triggerPrice");
    expect(order).toHaveProperty("triggerCondition");
    expect(order).toHaveProperty("timestamp");
  });

  test("returns count=0 and empty array when no orders", async () => {
    mockFrontendOpenOrders.mockImplementationOnce(async () => []);
    const result = await ordersCommand.run() as { count: number; orders: unknown[] };
    expect(result.count).toBe(0);
    expect(result.orders).toEqual([]);
  });
});
