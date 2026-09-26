export interface PurchaseRequest {
  orderId: string;
  customer: { firstName: string; lastName: string; email: string; phone: string | null };
  offer: { name: string; currency: string; maxioProductHandle: string | null };
  paymentType: "full" | "instalment";
  quantity: number;
  /** Amount to charge right now (full price, or the first instalment). */
  amountDueNowCents: number;
  /** Token from the provider's hosted card fields. Card numbers never reach our server. */
  paymentToken: string;
}

export type PurchaseResult =
  | { ok: true; transactionId: string; subscriptionId: string | null; customerId: string | null }
  | { ok: false; reason: string };

export interface PaymentProvider {
  name: "mock" | "maxio";
  /** Charge the amount due now. Later instalments are charged by the provider and reported via webhooks. */
  purchase(req: PurchaseRequest): Promise<PurchaseResult>;
}
