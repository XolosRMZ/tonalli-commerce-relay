import type {
  CommerceOrder,
  CommerceQuote,
  EscrowReference,
  StoreProductReference,
} from "@xolosarmy/models";
import { prisma, type Prisma } from "@xolosarmy/db";

import type { OrderStore } from "./order-store";

type PrismaOrderWithEscrow = Prisma.OrderGetPayload<{
  include: {
    escrowRecord: true;
  };
}>;

export class PrismaOrderStore implements OrderStore {
  async create(order: CommerceOrder): Promise<CommerceOrder> {
    const createdOrder = await prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          id: order.id,
          buyerUserId: order.buyerUserId,
          intermediaryUserId: order.intermediaryUserId,
          arbitratorUserId: order.arbitratorUserId,
          moderatorUserId: order.moderatorUserId,
          status: order.status,
          disputeStatus: order.disputeStatus,
          product: toInputJson(order.product),
          quote: toInputJson(order.quote),
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
          escrowRecord:
            order.escrow === undefined
              ? undefined
              : {
                  create: toEscrowRecordCreateInput(order.escrow),
                },
          events: {
            create: {
              type: "order_created",
              actorUserId: order.buyerUserId,
              payload: toInputJson({ status: order.status }),
            },
          },
        },
        include: {
          escrowRecord: true,
        },
      });
    });

    return toCommerceOrder(createdOrder);
  }

  async findById(id: string): Promise<CommerceOrder | null> {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        escrowRecord: true,
      },
    });

    return order === null ? null : toCommerceOrder(order);
  }

  async list(): Promise<CommerceOrder[]> {
    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        escrowRecord: true,
      },
    });

    return orders.map(toCommerceOrder);
  }

  async update(
    id: string,
    patch: Partial<CommerceOrder>,
  ): Promise<CommerceOrder | null> {
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });

    if (existingOrder === null) {
      return null;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: toOrderUpdateData(patch),
        include: {
          escrowRecord: true,
        },
      });

      if (patch.escrow !== undefined) {
        await tx.escrowRecord.upsert({
          where: { orderId: id },
          create: {
            orderId: id,
            ...toEscrowRecordCreateInput(patch.escrow),
          },
          update: toEscrowRecordUpdateInput(patch.escrow),
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          type: "order_updated",
          payload: toInputJson({
            patchKeys: Object.keys(patch),
          }),
        },
      });

      if (patch.escrow === undefined) {
        return updated;
      }

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          escrowRecord: true,
        },
      });
    });

    return toCommerceOrder(updatedOrder);
  }
}

function toOrderUpdateData(patch: Partial<CommerceOrder>): Prisma.OrderUpdateInput {
  const data: Prisma.OrderUpdateInput = {
    updatedAt: new Date(),
  };

  if (patch.buyerUserId !== undefined) {
    data.buyerUserId = patch.buyerUserId;
  }

  if (patch.intermediaryUserId !== undefined) {
    data.intermediaryUserId = patch.intermediaryUserId;
  }

  if (patch.arbitratorUserId !== undefined) {
    data.arbitratorUserId = patch.arbitratorUserId;
  }

  if (patch.moderatorUserId !== undefined) {
    data.moderatorUserId = patch.moderatorUserId;
  }

  if (patch.status !== undefined) {
    data.status = patch.status;
  }

  if (patch.disputeStatus !== undefined) {
    data.disputeStatus = patch.disputeStatus;
  }

  if (patch.product !== undefined) {
    data.product = toInputJson(patch.product);
  }

  if (patch.quote !== undefined) {
    data.quote = toInputJson(patch.quote);
  }

  if (patch.createdAt !== undefined) {
    data.createdAt = new Date(patch.createdAt);
  }

  return data;
}

function toEscrowRecordCreateInput(
  escrow: EscrowReference,
): Omit<Prisma.EscrowRecordUncheckedCreateInput, "orderId"> {
  return {
    escrowAddress: escrow.escrowAddress,
    escrowScriptHex: escrow.escrowScriptHex,
    depositTxid: escrow.depositTxid,
    releaseTxid: escrow.releaseTxid,
    refundTxid: escrow.refundTxid,
    nonce: escrow.nonce,
  };
}

function toEscrowRecordUpdateInput(
  escrow: EscrowReference,
): Prisma.EscrowRecordUpdateInput {
  const data: Prisma.EscrowRecordUpdateInput = {};

  if (escrow.escrowAddress !== undefined) {
    data.escrowAddress = escrow.escrowAddress;
  }

  if (escrow.escrowScriptHex !== undefined) {
    data.escrowScriptHex = escrow.escrowScriptHex;
  }

  if (escrow.depositTxid !== undefined) {
    data.depositTxid = escrow.depositTxid;
  }

  if (escrow.releaseTxid !== undefined) {
    data.releaseTxid = escrow.releaseTxid;
  }

  if (escrow.refundTxid !== undefined) {
    data.refundTxid = escrow.refundTxid;
  }

  if (escrow.nonce !== undefined) {
    data.nonce = escrow.nonce;
  }

  return data;
}

function toCommerceOrder(order: PrismaOrderWithEscrow): CommerceOrder {
  return {
    id: order.id,
    buyerUserId: order.buyerUserId,
    intermediaryUserId: order.intermediaryUserId ?? undefined,
    arbitratorUserId: order.arbitratorUserId ?? undefined,
    moderatorUserId: order.moderatorUserId ?? undefined,
    product: fromPersistedJson<StoreProductReference>(order.product, "Order.product"),
    quote: fromPersistedJson<CommerceQuote>(order.quote, "Order.quote"),
    status: order.status as CommerceOrder["status"],
    escrow:
      order.escrowRecord === null
        ? {}
        : {
            escrowAddress: order.escrowRecord.escrowAddress ?? undefined,
            escrowScriptHex: order.escrowRecord.escrowScriptHex ?? undefined,
            depositTxid: order.escrowRecord.depositTxid ?? undefined,
            releaseTxid: order.escrowRecord.releaseTxid ?? undefined,
            refundTxid: order.escrowRecord.refundTxid ?? undefined,
            nonce: order.escrowRecord.nonce ?? undefined,
          },
    disputeStatus: order.disputeStatus as CommerceOrder["disputeStatus"],
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  const json = JSON.parse(JSON.stringify(value)) as unknown;

  if (!isInputJsonValue(json)) {
    throw new Error("Value must be JSON serializable");
  }

  return json;
}

function fromPersistedJson<T>(value: Prisma.JsonValue, fieldName: string): T {
  if (!isJsonObject(value)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return value as T;
}

function isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isInputJsonValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isInputJsonValue);
  }

  return false;
}
