import { z } from "incur";
import { coinSchema } from "../lib/schemas.js";
import {
  getExchange,
  getAssetIndex,
  getMidPrice,
  getRealCoinName,
  getInfo,
  getWalletAddress,
} from "../lib/client.js";
import { removeCoinState } from "../lib/state.js";
import { marketSlippagePrice } from "../lib/pricing.js";

export const closeCommand = {
  description: "Cancel all orders and close position at market (reduce-only)",
  args: z.object({
    coin: coinSchema,
    size: z.coerce.number().positive().optional().describe("Partial close size in base currency units (omit for full close)"),
  }),
  async run(c: { args: { coin: string; size?: number } }) {
    const realCoin = await getRealCoinName(c.args.coin);
    const assetIndex = await getAssetIndex(realCoin);
    const isPartialClose = c.args.size !== undefined;

    // 1. Cancel all open orders for this coin (skip for partial close to preserve TP/SL)
    let cancelledOrders = 0;
    if (!isPartialClose) {
      const openOrders = await getInfo().frontendOpenOrders({ user: getWalletAddress() });
      const coinOrders = openOrders.filter((o) => o.coin === realCoin);

      if (coinOrders.length > 0) {
        await getExchange().cancel({
          cancels: coinOrders.map((o) => ({ a: assetIndex, o: o.oid })),
        });
      }
      cancelledOrders = coinOrders.length;
    }

    // 2. Get current position
    const state = await getInfo().clearinghouseState({ user: getWalletAddress() });
    const position = state.assetPositions.find(
      (p) => p.position.coin === realCoin,
    );

    if (!position || parseFloat(position.position.szi) === 0) {
      if (!isPartialClose) await removeCoinState(realCoin);
      return {
        status: "ok",
        coin: realCoin,
        cancelledOrders,
        message: "No open position to close",
      };
    }

    // 3. Determine close size
    const posSize = parseFloat(position.position.szi);
    const isShort = posSize < 0;
    const absSize = Math.abs(posSize);
    const closeSize = isPartialClose ? c.args.size! : absSize;

    if (isPartialClose && closeSize > absSize) {
      return {
        status: "error",
        error: `Requested size ${closeSize} exceeds position size ${absSize}`,
      };
    }

    // 4. Close position at market (reduce-only)
    const midPrice = await getMidPrice(realCoin);
    const slippagePrice = marketSlippagePrice(midPrice, isShort);

    const result = await getExchange().order({
      orders: [
        {
          a: assetIndex,
          b: isShort,
          p: slippagePrice,
          s: closeSize.toString(),
          r: true,
          t: { limit: { tif: "FrontendMarket" } },
        },
      ],
      grouping: "na",
    });

    const status = result.response.data.statuses[0];

    if (typeof status === "object" && "filled" in status) {
      if (!isPartialClose) await removeCoinState(realCoin);
      return {
        status: isPartialClose ? "partially_closed" : "closed",
        coin: realCoin,
        closedSize: status.filled.totalSz,
        avgPrice: status.filled.avgPx,
        cancelledOrders,
      };
    }

    if (typeof status === "object" && "error" in status) {
      return { status: "error", error: status.error };
    }

    return { status: "unknown", raw: String(status) };
  },
};
