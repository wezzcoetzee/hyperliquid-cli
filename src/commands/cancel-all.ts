import { z } from "incur";
import { coinSchema } from "../lib/schemas.js";
import { getExchange, getAssetIndex, getRealCoinName, getInfo, getWalletAddress } from "../lib/client.js";

export const cancelAllCommand = {
  description: "Cancel all open orders for a coin",
  args: z.object({
    coin: coinSchema,
  }),
  async run(c: { args: { coin: string } }) {
    const realCoin = await getRealCoinName(c.args.coin);
    const assetIndex = await getAssetIndex(realCoin);

    const openOrders = await getInfo().frontendOpenOrders({ user: getWalletAddress() });
    const coinOrders = openOrders.filter((o) => o.coin === realCoin);

    if (coinOrders.length === 0) {
      return { status: "ok", coin: realCoin, cancelled: 0, message: "No open orders" };
    }

    await getExchange().cancel({
      cancels: coinOrders.map((o) => ({ a: assetIndex, o: o.oid })),
    });

    return {
      status: "ok",
      coin: realCoin,
      cancelled: coinOrders.length,
      orders: coinOrders.map((o) => ({
        oid: o.oid,
        type: o.orderType,
        side: o.side,
        price: o.limitPx,
        size: o.sz,
      })),
    };
  },
};
