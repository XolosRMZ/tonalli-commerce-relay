import type {
  ConnectParams,
  RequestArguments,
  UniversalProviderOpts,
} from "@walletconnect/universal-provider";

import {
  MockTonalliWalletConnector,
  type TonalliWalletConnector,
} from "./wallet-adapter";

const TONALLI_CHAIN_ID = "ecash:1";
const TONALLI_NAMESPACE = "ecash";
const SIGN_MESSAGE_METHOD = "ecash_signMessage";

export interface WalletConnectProviderLike {
  session?: unknown;
  connect(opts: ConnectParams): Promise<unknown>;
  request<T = unknown>(
    args: RequestArguments,
    chain?: string,
  ): Promise<T>;
}

export type WalletConnectProviderFactory = (
  opts: UniversalProviderOpts,
) => Promise<WalletConnectProviderLike>;

export interface WalletConnectTonalliConnectorOptions {
  projectId?: string;
  relayUrl?: string;
  providerFactory?: WalletConnectProviderFactory;
}

export class WalletConnectTonalliConnector implements TonalliWalletConnector {
  private provider: WalletConnectProviderLike | null = null;

  constructor(private readonly options: WalletConnectTonalliConnectorOptions) {}

  async connect(): Promise<void> {
    const provider = await this.getProvider();

    if (provider.session !== undefined) {
      return;
    }

    await provider.connect({
      namespaces: {
        [TONALLI_NAMESPACE]: {
          chains: [TONALLI_CHAIN_ID],
          methods: [SIGN_MESSAGE_METHOD],
          events: [],
        },
      },
    });
  }

  async signMessage(input: {
    address: string;
    message: string;
  }): Promise<string> {
    if (input.message.trim().length === 0) {
      throw new Error("WalletConnect requires a non-empty message");
    }

    await this.connect();
    const provider = await this.getProvider();
    const result = await provider.request<string>(
      {
        method: SIGN_MESSAGE_METHOD,
        params: {
          address: input.address,
          message: input.message,
        },
      },
      TONALLI_CHAIN_ID,
    );

    if (typeof result !== "string" || result.trim().length === 0) {
      throw new Error("WalletConnect returned an empty signature");
    }

    return result;
  }

  private async getProvider(): Promise<WalletConnectProviderLike> {
    if (this.provider !== null) {
      return this.provider;
    }

    if (typeof window === "undefined") {
      throw new Error("WalletConnect is only available in the browser");
    }

    if (this.options.projectId === undefined || this.options.projectId === "") {
      throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required");
    }

    const providerFactory =
      this.options.providerFactory ?? defaultProviderFactory;

    this.provider = await providerFactory({
      projectId: this.options.projectId,
      relayUrl: this.options.relayUrl,
      metadata: {
        name: "Tonalli Commerce Relay",
        description: "TonalliAuth session signing",
        url: window.location.origin,
        icons: [],
      },
    });

    return this.provider;
  }
}

export function createTonalliWalletConnector(): TonalliWalletConnector {
  if (process.env.NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR === "walletconnect") {
    return new WalletConnectTonalliConnector({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      relayUrl: process.env.NEXT_PUBLIC_TONALLI_WC_RELAY_URL,
    });
  }

  return new MockTonalliWalletConnector();
}

async function defaultProviderFactory(
  opts: UniversalProviderOpts,
): Promise<WalletConnectProviderLike> {
  const { UniversalProvider } = await import("@walletconnect/universal-provider");

  return UniversalProvider.init(opts);
}
