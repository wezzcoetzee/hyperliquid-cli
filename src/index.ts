import { createRequire } from "node:module";
import { Cli } from "incur";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
import { openCommand } from "./commands/open.js";
import { closeCommand } from "./commands/close.js";
import { stopLossCommand } from "./commands/stop-loss.js";
import { takeProfitCommand } from "./commands/take-profit.js";
import { moveSlCommand } from "./commands/move-sl.js";
import { cancelAllCommand } from "./commands/cancel-all.js";
import { setLeverageCommand } from "./commands/set-leverage.js";
import { positionsCommand } from "./commands/positions.js";
import { balanceCommand } from "./commands/balance.js";
import { ordersCommand } from "./commands/orders.js";

const cli = Cli.create("hl", {
  description: "Hyperliquid trading executor — CLI",
  version,
})
  .command("open", openCommand)
  .command("close", closeCommand)
  .command("stop-loss", stopLossCommand)
  .command("take-profit", takeProfitCommand)
  .command("move-sl", moveSlCommand)
  .command("cancel-all", cancelAllCommand)
  .command("set-leverage", setLeverageCommand)
  .command("positions", positionsCommand)
  .command("balance", balanceCommand)
  .command("orders", ordersCommand);

cli.serve();
