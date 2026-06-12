export type StoreProvider =
  | "amazon_mx"
  | "mercado_libre_mx"
  | "walmart_mx"
  | "other";

export interface StoreProductReference {
  provider: StoreProvider;
  productUrl: string;
  title?: string;
  quantity: number;
  notes?: string;
}
