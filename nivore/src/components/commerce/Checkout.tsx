"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GOVERNORATES, normalizeEgyptianMobile } from "@/domain/egypt";
import { formatEGP } from "@/domain/money";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/domain/models";
import { useBag } from "@/lib/cart";
import { cn } from "@/lib/cn";
import { toCheckoutItems, useQuote } from "./useQuote";

export interface CheckoutConfig {
  delivery: { enabled: boolean; note: string };
  pickup: { enabled: boolean; location: string; note: string };
  payments: {
    cod: { enabled: boolean; note: string };
    cop: { enabled: boolean; note: string };
    instapay: { enabled: boolean; handle: string | null; accountName: string | null; instructions: string; evidenceUploadEnabled: boolean };
  };
  devMode: boolean;
  notificationsConnected: boolean;
}

type Fields = Record<string, string>;

export function CheckoutForm({ cfg }: { cfg: CheckoutConfig }) {
  const router = useRouter();
  const { items, hydrated, hydrate, clear } = useBag();
  useEffect(() => hydrate(), [hydrate]);
  const [method, setMethod] = useState<"delivery" | "pickup">(cfg.delivery.enabled ? "delivery" : "pickup");
  const [governorate, setGovernorate] = useState<string>("");
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [errors, setErrors] = useState<Fields>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const idempotencyKey = useRef<string>("");
  if (!idempotencyKey.current && typeof crypto !== "undefined") idempotencyKey.current = crypto.randomUUID?.() ?? String(Math.random()).slice(2);

  const { quote, loading } = useQuote(items, { promoCode: appliedPromo || undefined, method, governorate: governorate || null }, hydrated);

  const payments = useMemo(() => {
    const list: { id: PaymentMethod; note: string }[] = [];
    if (cfg.payments.cod.enabled && method === "delivery") list.push({ id: "cod", note: cfg.payments.cod.note });
    if (cfg.payments.cop.enabled && method === "pickup") list.push({ id: "cop", note: cfg.payments.cop.note });
    if (cfg.payments.instapay.enabled && cfg.payments.instapay.handle) list.push({ id: "instapay", note: "Transfer now; confirmed by the atelier by hand." });
    return list;
  }, [cfg, method]);
  useEffect(() => {
    if (payment && !payments.some((p) => p.id === payment)) setPayment("");
  }, [payments, payment]);

  if (!hydrated) return <div className="h-96" aria-busy="true" />;
  if (!items.length) {
    return (
      <div className="py-16 text-center">
        <p className="display text-3xl">Your bag is empty.</p>
        <Link href="/timepieces" className="btn btn-outline mt-6">Explore timepieces</Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "").trim();
    const local: Fields = {};
    if (v("name").length < 3) local.name = "Please enter your full name.";
    if (!normalizeEgyptianMobile(v("phone"))) local.phone = "Enter an Egyptian mobile number, e.g. 010 1234 5678.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v("email"))) local.email = "Please enter a valid email address.";
    if (method === "delivery") {
      if (!governorate) local.governorate = "Please choose a governorate.";
      if (v("city").length < 2) local.city = "Please enter your city or area.";
      if (v("address").length < 6) local.address = "Please enter the street, building and apartment.";
    }
    if (!payment) local.payment = "Please choose how you will pay.";
    if (!fd.get("privacy")) local.privacy = "Please accept the privacy notice to continue.";
    setErrors(local);
    if (Object.keys(local).length) {
      setFormError("Please check the highlighted fields.");
      document.querySelector<HTMLElement>(`[name="${Object.keys(local)[0]}"]`)?.focus();
      return;
    }
    const payload = {
      items: toCheckoutItems(items),
      name: v("name"),
      phone: v("phone"),
      altPhone: v("altPhone"),
      email: v("email"),
      method,
      governorate: method === "delivery" ? governorate : undefined,
      city: v("city"),
      address: v("address"),
      landmark: v("landmark"),
      notes: v("notes"),
      payment,
      transferReference: payment === "instapay" ? v("transferReference") : "",
      promoCode: appliedPromo,
      privacyAccepted: true,
      marketingConsent: fd.get("marketing") === "on",
      website: v("website"),
      idempotencyKey: idempotencyKey.current,
    };
    const body = new FormData();
    body.set("payload", JSON.stringify(payload));
    const file = fd.get("evidence");
    if (payment === "instapay" && file instanceof File && file.size) body.set("evidence", file);
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/orders", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.fields ?? {});
        setFormError(data.error ?? "Your order could not be placed. Please try again.");
        setSubmitting(false);
        return;
      }
      clear();
      router.push(`/order/${data.ref}?t=${encodeURIComponent(data.token)}`);
    } catch {
      setFormError("The connection dropped. Your order was not placed; please try again.");
      setSubmitting(false);
    }
  }

  const err = (k: string) => errors[k] && <span className="field-error" id={`${k}-err`}>{errors[k]}</span>;
  const input = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <input name={name} className="field" aria-invalid={errors[name] ? true : undefined} aria-describedby={errors[name] ? `${name}-err` : undefined} {...props} />
      {err(name)}
    </label>
  );
  const t = quote?.totals;
  const instapay = cfg.payments.instapay;

  return (
    <form onSubmit={submit} noValidate className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-12">
        {cfg.devMode && (
          <p className="border border-warn/40 bg-cream p-4 text-[13px] leading-relaxed">
            <strong className="font-medium">Preview mode.</strong> Orders placed here are saved in a local development store for testing. They are not real purchases and will not be fulfilled.
          </p>
        )}

        <fieldset className="space-y-5">
          <legend className="display mb-5 text-[1.8rem]">Your details</legend>
          {input("name", "Full name", { autoComplete: "name", required: true })}
          <div className="grid gap-5 sm:grid-cols-2">
            {input("phone", "Mobile number", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "010 1234 5678", required: true })}
            {input("email", "Email", { type: "email", autoComplete: "email", required: true })}
          </div>
          {input("altPhone", "Another number (optional)", { type: "tel", inputMode: "tel" })}
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="display mb-5 text-[1.8rem]">Delivery</legend>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Delivery method">
            {cfg.delivery.enabled && (
              <Choice checked={method === "delivery"} onChange={() => setMethod("delivery")} name="method" title="Deliver to me" note={cfg.delivery.note || "Delivery across Egypt"} />
            )}
            {cfg.pickup.enabled && <Choice checked={method === "pickup"} onChange={() => setMethod("pickup")} name="method" title="Collect from the atelier" note={cfg.pickup.location} />}
          </div>
          {method === "delivery" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label">Governorate</span>
                  <select name="governorate" className="field" value={governorate} onChange={(e) => setGovernorate(e.target.value)} aria-invalid={errors.governorate ? true : undefined}>
                    <option value="">Choose…</option>
                    {GOVERNORATES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  {err("governorate")}
                </label>
                {input("city", "City or area", { autoComplete: "address-level2" })}
              </div>
              {input("address", "Street, building, floor and apartment", { autoComplete: "street-address" })}
              {input("landmark", "Nearby landmark (optional)")}
            </>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="display mb-5 text-[1.8rem]">Payment</legend>
          {payments.length === 0 && <p className="text-[14px] text-taupe-ink">No payment option is available for this delivery method right now.</p>}
          <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
            {payments.map((p) => (
              <Choice key={p.id} checked={payment === p.id} onChange={() => setPayment(p.id)} name="payment" title={PAYMENT_METHOD_LABEL[p.id]} note={p.note} testId={`pay-${p.id}`} />
            ))}
          </div>
          {err("payment")}
          {payment === "instapay" && (
            <div className="space-y-5 border border-line bg-cream p-5">
              <p className="text-[14px] leading-relaxed">{instapay.instructions}</p>
              <dl className="grid gap-2 text-[14px] sm:grid-cols-[9rem_1fr]">
                <dt className="text-taupe-ink">Send to</dt>
                <dd className="font-medium">{instapay.handle}</dd>
                {instapay.accountName && (
                  <>
                    <dt className="text-taupe-ink">Account name</dt>
                    <dd>{instapay.accountName}</dd>
                  </>
                )}
                <dt className="text-taupe-ink">Amount</dt>
                <dd className="tabular font-medium">{t ? formatEGP(t.totalMinor) : "—"}</dd>
              </dl>
              {input("transferReference", "Transfer reference (optional now, helps us match it)", { maxLength: 60 })}
              {instapay.evidenceUploadEnabled && (
                <label className="block">
                  <span className="field-label">Screenshot of the transfer (optional)</span>
                  <input name="evidence" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="block w-full text-[13px] file:mr-4 file:border file:border-espresso file:bg-transparent file:px-4 file:py-2 file:text-[11px] file:uppercase file:tracking-[0.16em]" />
                  {err("evidence")}
                </label>
              )}
              <p className="text-[12px] leading-relaxed text-taupe-ink">
                This is not an automatic InstaPay integration. Your order stays pending until the atelier confirms the money has arrived; a reference or screenshot helps us find it but is not proof of payment.
              </p>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-5">
          <legend className="display mb-5 text-[1.8rem]">A note for the atelier</legend>
          <label className="block">
            <span className="sr-only">Order notes</span>
            <textarea name="notes" className="field" maxLength={600} placeholder="Anything we should know (optional)" />
          </label>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="sr-only">Privacy</legend>
          <div className="bg-cream p-5 text-[13px] leading-relaxed text-taupe-ink">
            <p className="font-medium text-espresso">How we use your details</p>
            <p className="mt-1">We use your name, contact details and address to prepare, deliver and support your order, and share your address only with the courier. We never ask for or store card details. Read the <Link href="/info/privacy" className="underline underline-offset-4">privacy notice</Link>.</p>
          </div>
          <label className="flex gap-3 text-[14px]">
            <input type="checkbox" name="privacy" className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" aria-invalid={errors.privacy ? true : undefined} />
            <span>I have read the privacy notice and agree to my details being used for this order.</span>
          </label>
          {err("privacy")}
          <label className="flex gap-3 text-[14px] text-taupe-ink">
            <input type="checkbox" name="marketing" className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" />
            <span>Write to me occasionally about new pieces (optional).</span>
          </label>
        </fieldset>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </div>

      <aside className="h-fit space-y-5 bg-cream p-6 lg:sticky lg:top-24">
        <h2 className="eyebrow">Order summary</h2>
        <ul className="space-y-3 text-[14px]">
          {items.map((i, idx) => (
            <li key={i.id} className="flex justify-between gap-4">
              <span>
                {quote?.lines[idx]?.name ?? i.name}
                {i.quantity > 1 && <span className="text-taupe-ink"> × {i.quantity}</span>}
                {quote?.lines[idx]?.error && <span className="block text-[12px] text-err">{quote.lines[idx].error}</span>}
              </span>
              <span className="tabular">{quote?.lines[idx] ? formatEGP(quote.lines[idx].unitMinor * i.quantity) : "—"}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="sr-only">Promo code</span>
            <input className="field !min-h-10 !py-2 text-sm uppercase" placeholder="Promo code" value={promo} onChange={(e) => setPromo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-outline !min-h-10" onClick={() => setAppliedPromo(promo.trim().toUpperCase())}>
            Apply
          </button>
        </div>
        {(t?.promoError || errors.promoCode) && appliedPromo && <p className="field-error !mt-1">{t?.promoError ?? errors.promoCode}</p>}
        <dl className="space-y-2 border-t border-line pt-4 text-[14px]">
          <Row label="Subtotal" value={t ? formatEGP(t.subtotalMinor) : "—"} />
          {t && t.discountMinor > 0 && <Row label={t.discountLabel ?? "Discount"} value={`− ${formatEGP(t.discountMinor)}`} />}
          <Row label="Delivery" value={t?.shippingMinor == null ? (method === "delivery" ? "Choose a governorate" : "—") : t.shippingMinor === 0 ? "No charge" : formatEGP(t.shippingMinor)} />
          {t && t.taxMinor > 0 && <Row label="Tax" value={formatEGP(t.taxMinor)} />}
          <div className="flex justify-between border-t border-line pt-3 text-[16px] font-medium">
            <dt>Total</dt>
            <dd className="tabular" data-testid="checkout-total">{t ? formatEGP(t.totalMinor) : "—"}</dd>
          </div>
        </dl>
        <p className="text-[12px] text-taupe-ink" aria-live="polite">{loading ? "Confirming totals…" : "Totals are calculated by the atelier’s server."}</p>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={submitting || !quote?.ok} data-testid="place-order">
          {submitting ? "Placing your order…" : "Place order"}
        </button>
        {!cfg.notificationsConnected && <p className="text-[11.5px] text-taupe-ink">Confirmation messages are not sent automatically yet; the atelier will contact you directly.</p>}
      </aside>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-taupe-ink">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function Choice({ checked, onChange, name, title, note, testId }: { checked: boolean; onChange: () => void; name: string; title: string; note?: string; testId?: string }) {
  return (
    <label className={cn("flex cursor-pointer gap-3 border p-4 transition-colors", checked ? "border-espresso shadow-[inset_0_0_0_1px_var(--color-espresso)]" : "border-line hover:border-line-strong")} data-testid={testId}>
      <input type="radio" name={name} className="mt-1 h-4 w-4 accent-[var(--color-espresso)]" checked={checked} onChange={onChange} />
      <span>
        <span className="block text-[14px]">{title}</span>
        {note && <span className="mt-0.5 block text-[12.5px] text-taupe-ink">{note}</span>}
      </span>
    </label>
  );
}
