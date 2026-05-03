import { describe, test, expect, vi } from "vitest";

const { mockClearinghouseState } = vi.hoisted(() => ({
  mockClearinghouseState: vi.fn(async () => ({
    crossMarginSummary: {
      accountValue: "10000.5",
      totalNtlPos: "5000",
      totalMarginUsed: "1000",
      totalRawUsd: "9500",
    },
    withdrawable: "8000",
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

const { balanceCommand } = await import("../../src/commands/balance.js");

describe("balanceCommand", () => {
  test("returns account balance fields", async () => {
    const result = await balanceCommand.run();
    expect(result).toEqual({
      accountValue: "10000.5",
      totalNotionalPosition: "5000",
      totalMarginUsed: "1000",
      withdrawable: "8000",
      rawUsd: "9500",
    });
  });

  test("maps crossMarginSummary fields correctly", async () => {
    mockClearinghouseState.mockImplementationOnce(async () => ({
      crossMarginSummary: {
        accountValue: "20000",
        totalNtlPos: "15000",
        totalMarginUsed: "3000",
        totalRawUsd: "18000",
      },
      withdrawable: "16000",
    }));
    const result = await balanceCommand.run() as Record<string, string>;
    expect(result.accountValue).toBe("20000");
    expect(result.totalNotionalPosition).toBe("15000");
    expect(result.withdrawable).toBe("16000");
    expect(result.rawUsd).toBe("18000");
  });
});
