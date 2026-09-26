"use client";

import { useActionState, useState } from "react";
import { submitCheckout } from "./actions";

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CheckoutForm(props: {
  code: string;
  currency: string;
  priceCents: number;
  instalmentCount: number | null;
  instalmentCents: number | null;
  mockPayments: boolean;
}) {
  const [state, action, pending] = useActionState(submitCheckout, undefined);
  const hasPlan = !!(props.instalmentCount && props.instalmentCents);
  const [paymentType, setPaymentType] = useState<"full" | "instalment">("full");
  const [quantity, setQuantity] = useState(1);
  const [decline, setDecline] = useState(false);

  const dueNow = (paymentType === "instalment" && hasPlan ? props.instalmentCents! : props.priceCents) * quantity;
  const err = (f: string) => state?.fieldErrors?.[f]?.[0];
  const input = "mt-1 block w-full min-w-0 appearance-none rounded-lg border border-line bg-white px-3 py-3 text-base outline-none focus:border-accent";
  const radio =
    "mt-0.5 h-[22px] w-[22px] flex-none appearance-none rounded-full border-2 border-[#b7bfd0] bg-white checked:border-accent checked:bg-[radial-gradient(circle,var(--color-accent)_0_5px,#fff_6px)]";
  const optionCls = (active: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${active ? "border-accent bg-accent/5" : "border-line"}`;

  return (
    <form action={action} className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <input type="hidden" name="code" value={props.code} />
      <input type="hidden" name="paymentType" value={paymentType} />
      {/* With Maxio this token comes from Chargify.js hosted card fields; card data never touches our server. */}
      <input type="hidden" name="paymentToken" value={decline ? "tok_decline" : "tok_mock"} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">How would you like to pay?</legend>
        <label className={optionCls(paymentType === "full")}>
          <input type="radio" className={radio} checked={paymentType === "full"} onChange={() => setPaymentType("full")} />
          <span>
            <span className="block font-medium text-ink">Pay in full</span>
            <span className="tabular text-sm text-ink-2">{money(props.priceCents, props.currency)}</span>
          </span>
        </label>
        {hasPlan && (
          <label className={optionCls(paymentType === "instalment")}>
            <input type="radio" className={radio} checked={paymentType === "instalment"} onChange={() => setPaymentType("instalment")} />
            <span>
              <span className="block font-medium text-ink">Instalment plan</span>
              <span className="tabular text-sm text-ink-2">
                {props.instalmentCount} payments of {money(props.instalmentCents!, props.currency)}
              </span>
            </span>
          </label>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3 [&>label]:min-w-0">
        <label className="block text-sm font-medium text-ink-2">
          First name
          <input name="firstName" required autoComplete="given-name" className={input} />
          {err("firstName") && <span className="text-xs text-bad">{err("firstName")}</span>}
        </label>
        <label className="block text-sm font-medium text-ink-2">
          Last name
          <input name="lastName" required autoComplete="family-name" className={input} />
          {err("lastName") && <span className="text-xs text-bad">{err("lastName")}</span>}
        </label>
      </div>
      <label className="block text-sm font-medium text-ink-2">
        Email
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={input} />
        {err("email") && <span className="text-xs text-bad">{err("email")}</span>}
      </label>
      <label className="block text-sm font-medium text-ink-2">
        Mobile
        <input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+61" className={input} />
      </label>
      <label className="block text-sm font-medium text-ink-2">
        Tickets / seats
        <select name="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={`${input} appearance-auto`}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      <div className="rounded-xl border border-dashed border-line bg-canvas p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">Card details</p>
        {props.mockPayments ? (
          <>
            <p className="mt-1">Test mode: no card needed. Maxio's secure card fields will appear here once connected.</p>
            <label className="mt-2 flex items-center gap-2 text-xs">
              <input type="checkbox" className="h-[18px] w-[18px] accent-accent" checked={decline} onChange={(e) => setDecline(e.target.checked)} /> Simulate a declined card
            </label>
          </>
        ) : (
          <p className="mt-1">Secure card fields load here.</p>
        )}
      </div>

      {state?.error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{state.error}</p>}

      <button disabled={pending} className="tabular w-full rounded-xl bg-accent py-3.5 text-base font-semibold text-white disabled:opacity-60">
        {pending ? "Processing…" : `Pay ${money(dueNow, props.currency)}${paymentType === "instalment" ? " today" : ""}`}
      </button>
    </form>
  );
}
