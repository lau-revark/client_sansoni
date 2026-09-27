import { randomUUID } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Stand-in for Maxio during development. Any token succeeds except "tok_decline",
 * which lets us exercise the failure path in the checkout.
 */
export const mockProvider: PaymentProvider = {
  name: "mock",
  async purchase(req) {
    if (req.paymentToken === "tok_decline") return { ok: false, reason: "Card declined (mock)" };
    return {
      ok: true,
      transactionId: `mock_txn_${randomUUID()}`,
      subscriptionId: req.paymentType === "instalment" ? `mock_sub_${randomUUID()}` : null,
      customerId: `mock_cus_${randomUUID()}`,
    };
  },
};
