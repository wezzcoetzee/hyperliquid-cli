import { z } from "incur";
import { getAssetIndex, getRealCoinName } from "../lib/client.js";
import { coinSchema } from "../lib/schemas.js";
import { placeTrigger } from "../lib/triggers.js";
import { getCoinState, updateCoinState } from "../lib/state.js";

export const stopLossCommand = {
  description: "Place a trigger stop-loss order (reduce-only)",
  args: z.object({
    side: z.enum(["long", "short"]).describe("Position side being protected (long or short)"),
    size: z.coerce.number().positive().describe("Size in base currency units"),
    coin: coinSchema,
    triggerPrice: z.coerce.number().positive().describe("Price at which stop-loss triggers"),
  }),
  async run(c: {
    args: { side: "long" | "short"; size: number; coin: string; triggerPrice: number };
  }) {
    const { side, size, coin, triggerPrice } = c.args;
    const realCoin = await getRealCoinName(coin);
    const assetIndex = await getAssetIndex(realCoin);

    const status = await placeTrigger({
      assetIndex,
      direction: side === "long" ? "LONG" : "SHORT",
      size,
      triggerPrice,
      kind: "sl",
    });

    let oid: number | null = null;
    if (typeof status === "object" && "resting" in status) {
      oid = status.resting.oid;
    }

    const coinState = getCoinState(realCoin);
    if (coinState) {
      await updateCoinState(realCoin, { slOid: oid });
    }

    if (status === "waitingForTrigger" || (typeof status === "object" && "resting" in status)) {
      return {
        status: "placed",
        coin: realCoin,
        side,
        size,
        triggerPrice,
        type: "stop-loss",
        oid,
      };
    }

    if (typeof status === "object" && "error" in status) {
      return { status: "error", error: status.error };
    }

    return { status: "unknown", raw: String(status) };
  },
};
