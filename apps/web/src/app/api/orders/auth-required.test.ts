import type { CommerceOrder, CommerceOrderStatus, CommerceQuote } from "@xolosarmy/models";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TONALLI_SESSION_COOKIE_NAME, createTonalliSessionToken } from "@/server/auth/session";
import { getDisputeStore } from "@/server/disputes/get-dispute-store";
import { getOrderStore } from "@/server/orders/get-order-store";

import { POST as createOrder } from "./route";
import { POST as acceptOrder } from "./[id]/accept/route";
import { POST as disputeOrder } from "./[id]/dispute/route";
import { POST as fundOrder } from "./[id]/fund/route";
import { POST as releaseOrder } from "./[id]/release/route";
import { POST as resolveDispute } from "./[id]/resolve-dispute/route";

const buyerUserId = "ecash:qbuyer";
const intermediaryUserId = "ecash:qintermediary";
const otherUserId = "ecash:qother";

describe("commerce routes with TonalliAuth required", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.TONALLI_AUTH_SESSION_SECRET;
    delete process.env.TONALLI_REQUIRE_AUTH;
    delete process.env.TONALLI_ARBITRATOR_USER_IDS;
    delete process.env.TONALLI_MODERATOR_USER_IDS;
  });

  it("rejects order creation without a session when auth is required", async () => {
    enableRequiredAuth();

    const response = await createOrder(
      jsonRequest("http://localhost:3000/api/orders", createOrderBody(buyerUserId)),
    );

    expect(response.status).toBe(401);
  });

  it("creates an order with a valid session", async () => {
    enableRequiredAuth();

    const response = await createOrder(
      await authenticatedJsonRequest(
        "http://localhost:3000/api/orders",
        createOrderBody(buyerUserId),
        buyerUserId,
      ),
    );

    expect(response.status).toBe(201);
  });

  it("rejects funding an order owned by another buyer", async () => {
    enableRequiredAuth();
    const order = await createStoredOrder("WAITING_DEPOSIT", buyerUserId);

    const response = await fundOrder(
      await authenticatedJsonRequest(
        `http://localhost:3000/api/orders/${order.id}/fund`,
        {
          buyer: { userId: buyerUserId, address: buyerUserId },
          simulatedDepositTxid: "simulated-deposit",
        },
        otherUserId,
      ),
      routeContext(order.id),
    );

    expect(response.status).toBe(403);
  });

  it("rejects accepting an order for a different intermediary", async () => {
    enableRequiredAuth();
    const order = await createStoredOrder("FUNDED", buyerUserId);

    const response = await acceptOrder(
      await authenticatedJsonRequest(
        `http://localhost:3000/api/orders/${order.id}/accept`,
        {
          intermediary: {
            userId: intermediaryUserId,
            address: intermediaryUserId,
          },
          reputationProfile: reputationProfile(intermediaryUserId),
          currentDailyVolumeFiatMxn: 0,
        },
        otherUserId,
      ),
      routeContext(order.id),
    );

    expect(response.status).toBe(403);
  });

  it("rejects release by a non-buyer", async () => {
    enableRequiredAuth();
    const order = await createStoredOrder(
      "RELEASE_PENDING",
      buyerUserId,
      intermediaryUserId,
    );

    const response = await releaseOrder(
      await authenticatedJsonRequest(
        `http://localhost:3000/api/orders/${order.id}/release`,
        {
          buyerUserId,
          buyer: { userId: buyerUserId, address: buyerUserId },
          intermediary: {
            userId: intermediaryUserId,
            address: intermediaryUserId,
          },
          simulatedReleaseTxid: "simulated-release",
          networkFeeXec: 1,
        },
        otherUserId,
      ),
      routeContext(order.id),
    );

    expect(response.status).toBe(403);
  });

  it("rejects dispute opening by a user outside the order", async () => {
    enableRequiredAuth();
    const order = await createStoredOrder(
      "PURCHASED",
      buyerUserId,
      intermediaryUserId,
    );

    const response = await disputeOrder(
      await authenticatedJsonRequest(
        `http://localhost:3000/api/orders/${order.id}/dispute`,
        {
          openedByUserId: otherUserId,
          reason: "not a participant",
        },
        otherUserId,
      ),
      routeContext(order.id),
    );

    expect(response.status).toBe(403);
  });

  it("rejects dispute resolution by a non-arbitrator", async () => {
    enableRequiredAuth();
    process.env.TONALLI_ARBITRATOR_USER_IDS = "ecash:qarbitrator";
    const order = await createStoredOrder(
      "DISPUTED",
      buyerUserId,
      intermediaryUserId,
    );
    const disputeStore = await getDisputeStore();
    await disputeStore.createDispute({
      orderId: order.id,
      status: "opened",
      openedByUserId: buyerUserId,
      reason: "test",
      openedAt: new Date().toISOString(),
    });

    const response = await resolveDispute(
      await authenticatedJsonRequest(
        `http://localhost:3000/api/orders/${order.id}/resolve-dispute`,
        {
          resolvedByUserId: otherUserId,
          authority: "arbitrator",
          resolution: "refund_to_buyer",
          buyer: { userId: buyerUserId, address: buyerUserId },
          arbitrator: { userId: otherUserId, address: otherUserId },
        },
        otherUserId,
      ),
      routeContext(order.id),
    );

    expect(response.status).toBe(403);
  });

  it("keeps legacy dev order creation working when auth is not required", async () => {
    process.env.TONALLI_REQUIRE_AUTH = "false";

    const response = await createOrder(
      jsonRequest("http://localhost:3000/api/orders", createOrderBody(buyerUserId)),
    );

    expect(response.status).toBe(201);
  });
});

function enableRequiredAuth(): void {
  process.env.TONALLI_REQUIRE_AUTH = "true";
  process.env.TONALLI_AUTH_SESSION_SECRET = "test-secret";
}

async function authenticatedJsonRequest(
  url: string,
  body: unknown,
  userId: string,
): Promise<Request> {
  const token = await createTonalliSessionToken({ address: userId });

  return jsonRequest(url, body, `${TONALLI_SESSION_COOKIE_NAME}=${token}`);
}

function jsonRequest(url: string, body: unknown, cookie?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });

  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }

  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function routeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createStoredOrder(
  status: CommerceOrderStatus,
  buyer: string,
  intermediary?: string,
): Promise<CommerceOrder> {
  const now = new Date().toISOString();
  const orderStore = await getOrderStore();

  return orderStore.create({
    id: crypto.randomUUID(),
    buyerUserId: buyer,
    intermediaryUserId: intermediary,
    arbitratorUserId: undefined,
    moderatorUserId: undefined,
    product: {
      provider: "other",
      productUrl: "https://example.com/product",
      quantity: 1,
    },
    quote: quote(),
    status,
    escrow: {},
    disputeStatus: status === "DISPUTED" ? "opened" : "none",
    createdAt: now,
    updatedAt: now,
  });
}

function createOrderBody(userId: string) {
  return {
    buyerUserId: userId,
    buyerAddress: userId,
    product: {
      provider: "other",
      productUrl: "https://example.com/product",
      quantity: 1,
    },
    quote: quote(),
  };
}

function quote(): CommerceQuote {
  const quotedAt = new Date().toISOString();

  return {
    productCostFiat: { amount: 100, currency: "MXN" },
    intermediaryFeeFiat: { amount: 10, currency: "MXN" },
    platformFeeFiat: { amount: 5, currency: "MXN" },
    networkFeeReserveXec: { amount: 1, currency: "XEC" },
    totalFiat: { amount: 115, currency: "MXN" },
    totalXec: { amount: 1000, currency: "XEC" },
    rate: {
      fiatCurrency: "MXN",
      xecPerFiatUnit: 10,
      source: "test",
      quotedAt,
      expiresAt: quotedAt,
    },
  };
}

function reputationProfile(userId: string) {
  return {
    userId,
    address: userId,
    level: "trusted_intermediary",
    score: 100,
    completedOrders: 0,
    completedEligibleOrders: 0,
    totalVolumeXec: 0,
    totalVolumeFiatMxn: 0,
    openDisputes: 0,
    wonDisputes: 0,
    lostDisputes: 0,
    limits: {
      maxOrderFiatMxn: 10000,
      maxDailyFiatMxn: 10000,
    },
    isFrozen: false,
    updatedAt: new Date().toISOString(),
  };
}
