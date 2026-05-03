import { getInfo, getWalletAddress } from "../lib/client.js";

export const balanceCommand = {
  description: "Get perpetual account balance",
  async run() {
    const state = await getInfo().clearinghouseState({ user: getWalletAddress() });

    return {
      accountValue: state.crossMarginSummary.accountValue,
      totalNotionalPosition: state.crossMarginSummary.totalNtlPos,
      totalMarginUsed: state.crossMarginSummary.totalMarginUsed,
      withdrawable: state.withdrawable,
      rawUsd: state.crossMarginSummary.totalRawUsd,
    };
  },
};
