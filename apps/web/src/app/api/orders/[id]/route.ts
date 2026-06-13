import { NextResponse } from "next/server";

import { getOrderStore } from "@/server/orders/get-order-store";

interface OrderRouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: OrderRouteContext) {
  const { id } = await context.params;
  const orderStore = await getOrderStore();
  const order = await orderStore.findById(id);

  if (order === null) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
