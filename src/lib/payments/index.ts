import { maxioProvider } from "./maxio";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  if (name === "maxio") return maxioProvider;
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    throw new Error("Mock payments are disabled in production. Set PAYMENT_PROVIDER=maxio.");
  }
  return mockProvider;
}

export type { PaymentProvider, PurchaseRequest, PurchaseResult } from "./types";
