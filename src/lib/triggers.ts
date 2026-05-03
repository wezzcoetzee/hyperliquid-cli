import { getExchange } from "./client.js";

type TriggerOrderStatus =
  | "waitingForTrigger"
  | { resting: { oid: number } }
  | { error: string };

export async function placeTrigger(args: {
  assetIndex: number;
  direction: "LONG" | "SHORT";
  size: number;
  triggerPrice: number;
  kind: "sl" | "tp";
}): Promise<TriggerOrderStatus> {
  const { assetIndex, direction, size, triggerPrice, kind } = args;
  const isBuy = direction === "SHORT";

  const result = await getExchange().order({
    orders: [
      {
        a: assetIndex,
        b: isBuy,
        p: triggerPrice.toString(),
        s: size.toString(),
        r: true,
        t: {
          trigger: {
            isMarket: true,
            triggerPx: triggerPrice.toString(),
            tpsl: kind,
          },
        },
      },
    ],
    grouping: "na",
  });

  return result.response.data.statuses[0] as TriggerOrderStatus;
}
