import { z } from "incur";

export const coinSchema = z.string().trim().min(1).describe("Coin symbol (e.g. BTC, ETH, SOL)");
