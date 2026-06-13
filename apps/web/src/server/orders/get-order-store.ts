import type { OrderStore } from "./order-store";
import { orderStore } from "./order-store";

let prismaOrderStore: OrderStore | undefined;

async function getPrismaOrderStore(): Promise<OrderStore> {
  if (prismaOrderStore === undefined) {
    const { PrismaOrderStore } = await import("./prisma-order-store");
    prismaOrderStore = new PrismaOrderStore();
  }

  return prismaOrderStore;
}

export async function getOrderStore(): Promise<OrderStore> {
  const store = process.env.TONALLI_ORDER_STORE;

  if (store === undefined || store === "" || store === "memory") {
    return orderStore;
  }

  if (store === "prisma") {
    return getPrismaOrderStore();
  }

  throw new Error(`Unsupported TONALLI_ORDER_STORE value: ${store}`);
}
