import { describe, test, expect, vi, beforeEach } from "vitest";

const { mockUpdateLeverage, mockGetAssetIndex } = vi.hoisted(() => ({
  mockUpdateLeverage: vi.fn(async () => ({})),
  mockGetAssetIndex: vi.fn(async () => 3),
}));

vi.mock("../../src/lib/client.js", () => ({
  getExchange: () => ({ updateLeverage: mockUpdateLeverage }),
  getAssetIndex: mockGetAssetIndex,
  getMidPrice: vi.fn(async () => 0),
  getWalletAddress: () => "0xabc",
  getInfo: () => ({}),
}));

vi.mock("../../src/lib/state.js", () => ({
  getCoinState: vi.fn(() => null),
  updateCoinState: vi.fn(() => {}),
  setCoinState: vi.fn(() => {}),
  removeCoinState: vi.fn(() => {}),
}));

const { setLeverageCommand } = await import("../../src/commands/set-leverage.js");

describe("setLeverageCommand", () => {
  beforeEach(() => {
    mockUpdateLeverage.mockClear();
    mockGetAssetIndex.mockClear();
  });

  test("calls updateLeverage with correct params", async () => {
    await setLeverageCommand.run({ args: { coin: "BTC", leverage: 10 } });
    expect(mockUpdateLeverage).toHaveBeenCalledWith({ asset: 3, isCross: true, leverage: 10 });
  });

  test("returns ok status with coin and leverage", async () => {
    const result = await setLeverageCommand.run({ args: { coin: "BTC", leverage: 10 } });
    expect(result).toMatchObject({ status: "ok", coin: "BTC", leverage: 10, marginType: "cross" });
  });

  test("coin is uppercased", async () => {
    const result = await setLeverageCommand.run({ args: { coin: "eth", leverage: 5 } });
    expect((result as { coin: string }).coin).toBe("ETH");
  });

  test("uses isCross=true (cross margin)", async () => {
    await setLeverageCommand.run({ args: { coin: "BTC", leverage: 20 } });
    const callArg = mockUpdateLeverage.mock.calls[0][0] as { isCross: boolean };
    expect(callArg.isCross).toBe(true);
  });

  test("passes asset index from getAssetIndex", async () => {
    mockGetAssetIndex.mockImplementationOnce(async () => 7);
    await setLeverageCommand.run({ args: { coin: "ETH", leverage: 5 } });
    const callArg = mockUpdateLeverage.mock.calls[0][0] as { asset: number };
    expect(callArg.asset).toBe(7);
  });
});
