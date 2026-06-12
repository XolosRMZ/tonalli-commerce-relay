import type { CommerceOrder } from "@xolosarmy/models";

// TODO: reemplazar por PostgreSQL.
export class InMemoryOrderStore {
  private readonly orders = new Map<string, CommerceOrder>();

  async create(order: CommerceOrder): Promise<CommerceOrder> {
    this.orders.set(order.id, order);

    return order;
  }

  async findById(id: string): Promise<CommerceOrder | null> {
    return this.orders.get(id) ?? null;
  }

  async list(): Promise<CommerceOrder[]> {
    return Array.from(this.orders.values());
  }

  async update(
    id: string,
    patch: Partial<CommerceOrder>,
  ): Promise<CommerceOrder | null> {
    const existing = this.orders.get(id);

    if (existing === undefined) {
      return null;
    }

    const updated: CommerceOrder = {
      ...existing,
      ...patch,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(id, updated);

    return updated;
  }
}

export const orderStore = new InMemoryOrderStore();
