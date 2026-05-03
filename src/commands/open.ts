import { z } from "incur";
import { coinSchema } from "../lib/schemas.js";
import { getExchange, getAssetIndex, getMidPrice, getRealCoinName } from "../lib/client.js";
import { setCoinState } from "../lib/state.js";
import { marketSlippagePrice } from "../lib/pricing.js";



export const openCommand = {
  description: "Open a position at market price",
  args: z.object({
    side: z.enum(["long", "short"]).describe("Position side (long or short)"),
    size: z.coerce.number().positive().describe("Size in base currency units"),
    coin: coinSchema,
  }),
  async run(c: { args: { side: "long" | "short"; size: number; coin: string } }) {
    const { side, size, coin } = c.args;
    const realCoin = await getRealCoinName(coin);
    const assetIndex = await getAssetIndex(realCoin);
    const isBuy = side === "long";

    const midPrice = await getMidPrice(realCoin);
    const slippagePrice = marketSlippagePrice(midPrice, isBuy);

    const result = await getExchange().order({
      orders: [
        {
          a: assetIndex,
          b: isBuy,
          p: slippagePrice,
          s: size.toString(),
          r: false,
          t: { limit: { tif: "FrontendMarket" } },
        },
      ],
      grouping: "na",
    });

    const status = result.response.data.statuses[0];

    if (typeof status === "object" && "filled" in status) {
      await setCoinState(realCoin, {
        direction: side === "long" ? "LONG" : "SHORT",
        entry: parseFloat(status.filled.avgPx),
        slOid: null,
        tpOids: [],
        size,
      });

      return {
        status: "filled",
        coin: realCoin,
        side,
        size,
        avgPrice: status.filled.avgPx,
        totalSize: status.filled.totalSz,
      };
    }

    if (typeof status === "object" && "error" in status) {
      return { status: "error", error: status.error };
    }

    return { status: "unknown", raw: String(status) };
  },
};
