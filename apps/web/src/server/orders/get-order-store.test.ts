import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOrderStore } from "./get-order-store";
import { InMemoryOrderStore } from "./order-store";

vi.mock("./prisma-order-store", () => ({
  PrismaOrderStore: class PrismaOrderStore {},
}));

describe("getOrderStore", () => {
  beforeEach(() => {
    delete process.env.TONALLI_ORDER_STORE;
  });

  it("uses the in-memory store by default", async () => {
    const store = await getOrderStore();

    expect(store).toBeInstanceOf(InMemoryOrderStore);
  });

  it("uses the in-memory store when TONALLI_ORDER_STORE is memory", async () => {
    process.env.TONALLI_ORDER_STORE = "memory";

    const store = await getOrderStore();

    expect(store).toBeInstanceOf(InMemoryOrderStore);
  });

  it("returns a singleton in-memory store", async () => {
    const firstStore = await getOrderStore();
    const secondStore = await getOrderStore();

    expect(secondStore).toBe(firstStore);
  });

  it("uses the Prisma store when TONALLI_ORDER_STORE is prisma", async () => {
    process.env.TONALLI_ORDER_STORE = "prisma";

    const store = await getOrderStore();

    expect(store.constructor.name).toBe("PrismaOrderStore");
  });

  it("returns a singleton Prisma store", async () => {
    process.env.TONALLI_ORDER_STORE = "prisma";

    const firstStore = await getOrderStore();
    const secondStore = await getOrderStore();

    expect(secondStore).toBe(firstStore);
  });

  it("rejects unsupported store values", async () => {
    process.env.TONALLI_ORDER_STORE = "redis";

    await expect(getOrderStore()).rejects.toThrow(
      "Unsupported TONALLI_ORDER_STORE value: redis",
    );
  });
});
