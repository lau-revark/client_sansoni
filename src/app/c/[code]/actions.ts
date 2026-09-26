"use server";

import { redirect } from "next/navigation";
import { checkoutInput, processCheckout } from "@/lib/checkout";

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string[] | undefined> } | undefined;

export async function submitCheckout(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const parsed = checkoutInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: "Please check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const result = await processCheckout(parsed.data);
  if (!result.ok) return { error: result.error };
  redirect(`/c/${encodeURIComponent(parsed.data.code)}/thanks`);
}
