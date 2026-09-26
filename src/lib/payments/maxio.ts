import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentProvider } from "./types";

/**
 * Maxio Advanced Billing (formerly Chargify).
 *
 * TODO when API access arrives:
 * - purchase(): POST https://{subdomain}.chargify.com/subscriptions.json with
 *   { product_handle, customer_attributes, credit_card_attributes: { chargify_token } }.
 *   Instalment plans map to a product with N billing periods (or a component/coupon, depending on how
 *   Sansoni's Maxio site is configured).
 * - Store the returned subscription id on the order and the transaction id on the payment.
 */
export const maxioProvider: PaymentProvider = {
  name: "maxio",
  async purchase() {
    if (!process.env.MAXIO_API_KEY || !process.env.MAXIO_SUBDOMAIN) {
      return { ok: false, reason: "Maxio is not configured" };
    }
    throw new Error("Maxio purchase not implemented yet");
  },
};

/** Maxio signs webhook bodies with HMAC-SHA256 using the site's shared key (X-Chargify-Webhook-Signature-Hmac-Sha-256). */
export function verifyMaxioSignature(rawBody: string, signature: string | null, sharedKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", sharedKey).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
