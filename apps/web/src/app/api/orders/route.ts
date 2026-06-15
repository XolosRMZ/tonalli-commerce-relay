import type {
  CommerceOrder,
  CommerceQuote,
  StoreProductReference,
  StoreProvider,
} from "@xolosarmy/models";
import { NextResponse } from "next/server";

import {
  assertSameUser,
  forbiddenResponse,
  getAuthorizedArbitratorUserIds,
  getAuthorizedModeratorUserIds,
  getSessionUserId,
  isProductionAuthRequired,
  requireTonalliUser,
  unauthorizedResponse,
} from "@/server/auth/require-auth";
import { getOrderStore } from "@/server/orders/get-order-store";
import { validateOriginHeader } from "@/server/security/request-guards";

interface OrderRequestBody {
  buyerUserId?: unknown;
  buyerAddress?: unknown;
  buyerAlias?: unknown;
  product?: unknown;
  quote?: unknown;
}

interface ProductRequestBody {
  provider?: unknown;
  productUrl?: unknown;
  title?: unknown;
  quantity?: unknown;
  notes?: unknown;
}

interface ValidOrderRequest {
  buyerUserId: string;
  buyerAddress: string;
  buyerAlias?: string;
  product: StoreProductReference;
  quote: CommerceQuote;
}

type OrderRequestValidation =
  | { valid: true; request: ValidOrderRequest }
  | { valid: false; reason: string };

export async function GET() {
  const orderStore = await getOrderStore();
  const orders = await orderStore.list();

  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const originValidation = validateOriginHeader(request);

  if (!originValidation.valid) {
    return NextResponse.json(
      { error: "Invalid origin", reason: originValidation.reason },
      { status: 403 },
    );
  }

  const authRequired = isProductionAuthRequired();
  const sessionUser = await requireTonalliUser(request);

  if (authRequired && sessionUser === null) {
    return unauthorizedResponse();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    return invalidOrderRequestResponse(errorReason(error, "Request body must be valid JSON"));
  }

  const validation = validateOrderRequest(body);

  if (!validation.valid) {
    return invalidOrderRequestResponse(validation.reason);
  }

  const orderRequest = validation.request;

  if (authRequired && sessionUser !== null) {
    const sessionUserId = getSessionUserId(sessionUser);

    if (orderRequest.buyerUserId !== sessionUserId) {
      return forbiddenResponse();
    }
  }

  const now = new Date().toISOString();
  const order: CommerceOrder = {
    id: crypto.randomUUID(),
    buyerUserId: orderRequest.buyerUserId,
    intermediaryUserId: undefined,
    arbitratorUserId: undefined,
    moderatorUserId: undefined,
    product: orderRequest.product,
    quote: orderRequest.quote,
    status: "WAITING_DEPOSIT",
    escrow: {},
    disputeStatus: "none",
    createdAt: now,
    updatedAt: now,
  };

  const orderStore = await getOrderStore();
  const createdOrder = await orderStore.create(order);

  return NextResponse.json({ order: createdOrder }, { status: 201 });
}

function validateOrderRequest(body: unknown): OrderRequestValidation {
  if (!isObjectRecord(body)) {
    return invalidOrderRequest("Request body must be a JSON object");
  }

  const requestBody = body as OrderRequestBody;
  const buyerUserId = validateRequiredString(requestBody.buyerUserId, "buyerUserId");

  if (!buyerUserId.valid) {
    return invalidOrderRequest(buyerUserId.reason);
  }

  const buyerAddress = validateRequiredString(requestBody.buyerAddress, "buyerAddress");

  if (!buyerAddress.valid) {
    return invalidOrderRequest(buyerAddress.reason);
  }

  const buyerAlias = validateOptionalString(requestBody.buyerAlias, "buyerAlias");

  if (!buyerAlias.valid) {
    return invalidOrderRequest(buyerAlias.reason);
  }

  const product = validateProduct(requestBody.product);

  if (!product.valid) {
    return invalidOrderRequest(product.reason);
  }

  if (!isCommerceQuote(requestBody.quote)) {
    return invalidOrderRequest("quote must contain totalFiat and totalXec");
  }

  return {
    valid: true,
    request: {
      buyerUserId: buyerUserId.value,
      buyerAddress: buyerAddress.value,
      buyerAlias: buyerAlias.value,
      product: product.value,
      quote: requestBody.quote,
    },
  };
}

function validateProduct(
  value: unknown,
): { valid: true; value: StoreProductReference } | { valid: false; reason: string } {
  if (!isObjectRecord(value)) {
    return { valid: false, reason: "product must be a JSON object" };
  }

  const productBody = value as ProductRequestBody;
  const provider = validateStoreProvider(productBody.provider);

  if (!provider.valid) {
    return { valid: false, reason: provider.reason };
  }

  const productUrl = validateRequiredString(productBody.productUrl, "product.productUrl");

  if (!productUrl.valid) {
    return { valid: false, reason: productUrl.reason };
  }

  const quantity = validateRequiredPositiveNumber(productBody.quantity, "product.quantity");

  if (!quantity.valid) {
    return { valid: false, reason: quantity.reason };
  }

  const title = validateOptionalString(productBody.title, "product.title");

  if (!title.valid) {
    return { valid: false, reason: title.reason };
  }

  const notes = validateOptionalString(productBody.notes, "product.notes");

  if (!notes.valid) {
    return { valid: false, reason: notes.reason };
  }

  return {
    valid: true,
    value: {
      provider: provider.value,
      productUrl: productUrl.value,
      title: title.value,
      quantity: quantity.value,
      notes: notes.value,
    },
  };
}

function validateStoreProvider(
  value: unknown,
): { valid: true; value: StoreProvider } | { valid: false; reason: string } {
  if (
    value === "amazon_mx" ||
    value === "mercado_libre_mx" ||
    value === "walmart_mx" ||
    value === "other"
  ) {
    return { valid: true, value };
  }

  return {
    valid: false,
    reason:
      'product.provider must be one of "amazon_mx", "mercado_libre_mx", "walmart_mx", or "other"',
  };
}

function validateRequiredString(
  value: unknown,
  fieldName: string,
): { valid: true; value: string } | { valid: false; reason: string } {
  if (typeof value !== "string" || value.trim().length === 0) {
    return { valid: false, reason: `${fieldName} must be a non-empty string` };
  }

  return { valid: true, value: value.trim() };
}

function validateOptionalString(
  value: unknown,
  fieldName: string,
): { valid: true; value: string | undefined } | { valid: false; reason: string } {
  if (value === undefined) {
    return { valid: true, value: undefined };
  }

  if (typeof value !== "string") {
    return { valid: false, reason: `${fieldName} must be a string` };
  }

  const trimmed = value.trim();

  return { valid: true, value: trimmed.length === 0 ? undefined : trimmed };
}

function validateRequiredPositiveNumber(
  value: unknown,
  fieldName: string,
): { valid: true; value: number } | { valid: false; reason: string } {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return { valid: false, reason: `${fieldName} must be a number greater than 0` };
  }

  return { valid: true, value };
}

function isCommerceQuote(value: unknown): value is CommerceQuote {
  if (!isObjectRecord(value)) {
    return false;
  }

  return hasMoneyAmount(value.totalFiat) && hasMoneyAmount(value.totalXec);
}

function hasMoneyAmount(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  return typeof value.amount === "number" && Number.isFinite(value.amount);
}

function invalidOrderRequest(reason: string): OrderRequestValidation {
  return { valid: false, reason };
}

function invalidOrderRequestResponse(reason: string) {
  return NextResponse.json(
    {
      error: "Invalid order request",
      reason,
    },
    { status: 400 },
  );
}

function errorReason(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }

  return fallback;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
