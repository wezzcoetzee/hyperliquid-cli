import { getInfo, getWalletAddress } from "../lib/client.js";

export const ordersCommand = {
  description: "List open orders",
  async run() {
    const openOrders = await getInfo().frontendOpenOrders({ user: getWalletAddress() });

    const orders = openOrders.map((o) => ({
      coin: o.coin,
      oid: o.oid,
      side: o.side === "B" ? "BUY" : "SELL",
      orderType: o.orderType,
      price: o.limitPx,
      size: o.sz,
      originalSize: o.origSz,
      reduceOnly: o.reduceOnly,
      isTrigger: o.isTrigger,
      triggerPrice: o.triggerPx,
      triggerCondition: o.triggerCondition,
      timestamp: new Date(o.timestamp).toISOString(),
    }));

    return {
      count: orders.length,
      orders,
    };
  },
};
