import { ExchangeClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

let _info: InfoClient | null = null;
let _exchange: ExchangeClient | null = null;
let _walletAddress: string | null = null;

function buildClients(): void {
  if (_info && _exchange && _walletAddress) return;

  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("HYPERLIQUID_PRIVATE_KEY env var is required");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error(
      "HYPERLIQUID_PRIVATE_KEY must be a 32-byte hex string prefixed with 0x (64 hex chars)"
    );
  }

  const wallet = privateKeyToAccount(privateKey as Hex);
  const transport = new HttpTransport();

  _info = new InfoClient({ transport });
  _exchange = new ExchangeClient({ transport, wallet });
  _walletAddress = wallet.address;
}

export function getInfo(): InfoClient {
  buildClients();
  return _info!;
}

export function getExchange(): ExchangeClient {
  buildClients();
  return _exchange!;
}

export function getWalletAddress(): string {
  buildClients();
  return _walletAddress!;
}

let assetCache: Map<string, number> | null = null;
let realNameCache: Map<string, string> | null = null;
let cachePromise: Promise<void> | null = null;

function normaliseCoin(coin: string): string {
  if (/^k[A-Z0-9]/i.test(coin) && coin.length > 1) {
    return "k" + coin.slice(1).toUpperCase();
  }
  return coin.toUpperCase();
}

function buildCache(): Promise<void> {
  if (assetCache && realNameCache) return Promise.resolve();
  if (!cachePromise) {
    cachePromise = (async () => {
      const meta = await getInfo().meta();
      const a = new Map<string, number>();
      const r = new Map<string, string>();
      for (let i = 0; i < meta.universe.length; i++) {
        const realName = meta.universe[i].name;
        const key = normaliseCoin(realName);
        a.set(key, i);
        r.set(key, realName);
      }
      assetCache = a;
      realNameCache = r;
    })().catch((e) => {
      cachePromise = null;
      throw e;
    });
  }
  return cachePromise;
}

export async function getRealCoinName(coin: string): Promise<string> {
  await buildCache();
  const real = realNameCache!.get(normaliseCoin(coin));
  if (!real) {
    throw new Error(`Unknown coin: ${coin}. Not found in Hyperliquid universe.`);
  }
  return real;
}

export async function getAssetIndex(coin: string): Promise<number> {
  await buildCache();
  const index = assetCache!.get(normaliseCoin(coin));
  if (index === undefined) {
    throw new Error(`Unknown coin: ${coin}. Not found in Hyperliquid universe.`);
  }
  return index;
}

export async function getMidPrice(coin: string): Promise<number> {
  const mids = await getInfo().allMids();
  const realName = await getRealCoinName(coin);
  const price = mids[realName];
  if (!price) {
    throw new Error(`No mid price found for ${coin}`);
  }
  return parseFloat(price);
}
