import { z } from "incur";
import { coinSchema } from "../lib/schemas.js";
import { getExchange, getAssetIndex, getRealCoinName, getInfo, getWalletAddress } from "../lib/client.js";
import { placeTrigger } from "../lib/triggers.js";
import { getCoinState, updateCoinState } from "../lib/state.js";

export const moveSlCommand = {
  description: "Cancel existing stop-loss and replace at a new price",
  args: z.object({
    coin: coinSchema,
    newPrice: z.coerce.number().positive().describe("New stop-loss trigger price"),
  }),
  async run(c: { args: { coin: string; newPrice: number } }) {
    const { coin, newPrice } = c.args;
    const realCoin = await getRealCoinName(coin);
    const assetIndex = await getAssetIndex(realCoin);
    const coinState = getCoinState(realCoin);

    let direction: "LONG" | "SHORT";
    let size: number;

    if (coinState) {
      direction = coinState.direction;
      size = coinState.size;
    } else {
      const state = await getInfo().clearinghouseState({ user: getWalletAddress() });
      const position = state.assetPositions.find(
        (p) => p.position.coin === realCoin,
      );
      if (!position || parseFloat(position.position.szi) === 0) {
        return { status: "error", error: `No open position for ${realCoin}` };
      }
      const posSize = parseFloat(position.position.szi);
      direction = posSize > 0 ? "LONG" : "SHORT";
      size = Math.abs(posSize);
    }

    const status = await placeTrigger({
      assetIndex,
      direction,
      size,
      triggerPrice: newPrice,
      kind: "sl",
    });

    if (typeof status === "object" && "error" in status) {
      return { status: "error", error: status.error };
    }

    const isSuccess =
      status === "waitingForTrigger" ||
      (typeof status === "object" && "resting" in status);

    if (!isSuccess) {
      return { status: "unknown", raw: status };
    }

    let newOid: number | null = null;
    if (typeof status === "object" && "resting" in status) {
      newOid = status.resting.oid;
    }

    if (coinState?.slOid) {
      await getExchange().cancel({
        cancels: [{ a: assetIndex, o: coinState.slOid }],
      });
    } else {
      const openOrders = await getInfo().frontendOpenOrders({ user: getWalletAddress() });
      const slOrders = openOrders.filter(
        (o) =>
          o.coin === realCoin &&
          o.orderType.includes("Stop") &&
          o.reduceOnly,
      );
      if (slOrders.length > 0) {
        await getExchange().cancel({
          cancels: slOrders.map((o) => ({ a: assetIndex, o: o.oid })),
        });
      }
    }

    if (coinState) {
      await updateCoinState(realCoin, { slOid: newOid });
    }

    return {
      status: "moved",
      coin: realCoin,
      newTriggerPrice: newPrice,
      direction,
      size,
      oid: newOid,
    };
  },
};
