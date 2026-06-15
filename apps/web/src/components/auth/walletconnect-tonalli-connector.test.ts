import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectParams, RequestArguments } from "@walletconnect/universal-provider";

import {
  createTonalliWalletConnector,
  WalletConnectTonalliConnector,
  type WalletConnectProviderLike,
} from "./walletconnect-tonalli-connector";
import { MockTonalliWalletConnector } from "./wallet-adapter";

describe("WalletConnectTonalliConnector", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_TONALLI_WALLET_CONNECTOR;
    delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  });

  it("throws a clear error when project id is missing", async () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const connector = new WalletConnectTonalliConnector({});

    await expect(connector.connect()).rejects.toThrow(
      "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required",
    );
  });

  it("connects with the ecash namespace and signs with ecash_signMessage", async () => {
    vi.stubGlobal("window", { location: { origin: "http://localhost:3000" } });
    const connectCalls: ConnectParams[] = [];
    const requestCalls: Array<{ args: RequestArguments; chain?: string }> = [];
    const provider: WalletConnectProviderLike = {
      async connect(opts) {
        connectCalls.push(opts);
        return {};
      },
      async request<T = unknown>(args: RequestArguments, chain?: string) {
        requestCalls.push({ args, chain });
        return "base64-signature" as T;
      },
    };
    const connector = new WalletConnectTonalliConnector({
      projectId: "project-id",
      providerFactory: async () => provider,
    });

    await expect(
      connector.signMessage({
        address: "ecash:qbuyer",
        message: "Sign in to Tonalli Commerce Relay",
      }),
    ).resolves.toBe("base64-signature");

    expect(connectCalls).toEqual([{
      namespaces: {
        ecash: {
          chains: ["ecash:1"],
          methods: ["ecash_signMessage"],
          events: [],
        },
      },
    }]);
    expect(requestCalls).toEqual([
      {
        args: {
          method: "ecash_signMessage",
          params: {
            address: "ecash:qbuyer",
            message: "Sign in to Tonalli Commerce Relay",
          },
        },
        chain: "ecash:1",
      },
    ]);
  });

  it("creates the mock connector by default", () => {
    expect(createTonalliWalletConnector()).toBeInstanceOf(
      MockTonalliWalletConnector,
    );
  });
});
