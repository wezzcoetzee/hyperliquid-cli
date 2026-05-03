import { z } from "incur";
import { coinSchema } from "../lib/schemas.js";
import { getExchange, getAssetIndex } from "../lib/client.js";

export const setLeverageCommand = {
  description: "Set leverage for a coin (cross margin)",
  args: z.object({
    coin: coinSchema,
    leverage: z.coerce.number().int().positive().describe("Leverage multiplier"),
  }),
  async run(c: { args: { coin: string; leverage: number } }) {
    const upperCoin = c.args.coin.toUpperCase();
    const assetIndex = await getAssetIndex(upperCoin);

    await getExchange().updateLeverage({
      asset: assetIndex,
      isCross: true,
      leverage: c.args.leverage,
    });

    return {
      status: "ok",
      coin: upperCoin,
      leverage: c.args.leverage,
      marginType: "cross",
    };
  },
};
