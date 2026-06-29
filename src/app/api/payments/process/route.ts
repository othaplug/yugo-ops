import { NextResponse, after } from "next/server";
import { createHash } from "crypto";
import { squareClient } from "@/lib/square";
import { getSquarePaymentConfig } from "@/lib/square-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createMoveFromQuote } from "@/lib/automations/create-move-from-quote";
import { createDeliveryFromB2BQuote } from "@/lib/automations/create-delivery-from-b2b-quote";
import { runPostPaymentActions, runPostPaymentActionsB2BDelivery } from "@/lib/automations/post-payment";
import {
  issueDeliveryTrackingTokens,
  sendB2BTrackingNotifications,
} from "@/lib/delivery-tracking-tokens";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { decideBookingPayment } from "@/lib/quotes/booking-payment-window";
import { rateLimit } from "@/lib/rate-limit";
import { isQuoteExpiredForBooking, quoteExpiryBlockedStatuses } from "@/lib/quote-expiry";
import { squareThrownErrorStructured } from "@/lib/square-payment-errors";
import { squareIdem } from "@/lib/square-idempotency";
import { logActivity } from "@/lib/activity";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { buildPaymentFailedClientEmailHtml } from "@/lib/email/payment-failed-client-email";
import { sendEmail } from "@/lib/email/send";
import {
  expectedB2BCardGrandTotalCad,
  isB2BInvoiceQuote,
  isB2BDeliveryQuoteServiceType,
} from "@/lib/quotes/b2b-quote-copy";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`pay:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      sourceId,
      amount,
      quoteId,
      clientName,
      clientEmail,
      selectedTier,
      selectedAddons,
    } = body as {
      sourceId: string;
      amount: number;
      quoteId: string;
      clientName: string;
      clientEmail: string;
      selectedTier?: string;
      selectedAddons?: unknown[];
    };

    if (!sourceId || !amount || !quoteId || !clientName || !clientEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── 1. Verify quote exists and amount is plausible ──
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("quote_id", quoteId)
      .single();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status === "accepted") {
      return NextResponse.json({ error: "Quote already accepted" }, { status: 409 });
    }

    const st = String(quote.status || "").toLowerCase();
    if (quoteExpiryBlockedStatuses().includes(st)) {
      return NextResponse.json(
        { error: "This quote is no longer available. Request a new quote if you still need service." },
        { status: 410 },
      );
    }
    if (isQuoteExpiredForBooking(quote)) {
      return NextResponse.json(
        { error: "This quote has expired. Request a new quote from your coordinator." },
        { status: 410 },
      );
    }

    const factors = quote.factors_applied as Record<string, unknown> | null | undefined;
    const svc = String(quote.service_type ?? "");
    const selAddons = quote.selected_addons;
    const noQuoteAddons =
      selAddons == null || (Array.isArray(selAddons) && selAddons.length === 0);
    if (
      isB2BDeliveryQuoteServiceType(svc) &&
      !isB2BInvoiceQuote(factors, svc) &&
      noQuoteAddons
    ) {
      const expected = expectedB2BCardGrandTotalCad({
        custom_price: quote.custom_price != null ? Number(quote.custom_price) : null,
        service_type: svc,
      });
      if (expected != null && Math.abs(Number(amount) - expected) > 1.5) {
        return NextResponse.json(
          { error: "Payment amount does not match the quoted total. Refresh the page or contact your coordinator." },
          { status: 400 },
        );
      }
    }

    // ── Server-side 48h booking-window enforcement ──
    // If a quote is being booked inside the full-payment window, the client
    // MUST pay the full grand total — not the deposit. We enforce this
    // independently of the client so a stale form (or someone crafting a
    // payment payload manually) can't bypass it. Bin rental and B2B
    // invoice flows are exempt (they're full-pay or net-30 already).
    if (
      svc !== "bin_rental" &&
      !isB2BInvoiceQuote(factors, svc) &&
      quote.move_date
    ) {
      const taxRateForCheck = Number(factors?.tax_rate ?? 0.13);
      const customPrice = Number(quote.custom_price ?? 0);
      const depositOnQuote = Number(quote.deposit_amount ?? 0);
      // Best-effort grand total: prefer the stored custom_price (already
      // tax-inclusive on most service types) when available; otherwise
      // approximate from deposit. Tolerance below covers any drift.
      const grandTotalForCheck =
        customPrice > 0
          ? Math.round(customPrice * (1 + taxRateForCheck))
          : depositOnQuote;
      const decision = decideBookingPayment({
        moveDate: quote.move_date as string,
        deposit: depositOnQuote,
        grandTotal: grandTotalForCheck,
        serverSide: true,
      });
      if (decision.requireFullPayment) {
        // Require client to pay at least 98% of the grand total (allow 2%
        // tolerance for rounding / tax delta between client and server).
        const minRequired = Math.floor(grandTotalForCheck * 0.98);
        if (Number(amount) < minRequired) {
          console.warn("[payments/process] full-payment required, deposit submitted", {
            quoteId,
            moveDate: quote.move_date,
            hoursUntilMove: decision.hoursUntilMove,
            submittedAmount: amount,
            grandTotal: grandTotalForCheck,
          });
          return NextResponse.json(
            {
              error: `Your move is in ${decision.hoursUntilMove} hours, so the full balance is collected at booking. Refresh the page — the form will switch to full payment automatically.`,
              code: "FULL_PAYMENT_REQUIRED",
              hours_until_move: decision.hoursUntilMove,
              grand_total: grandTotalForCheck,
            },
            { status: 400 },
          );
        }
      }
    }

    const amountCents = Math.round(amount * 100);
    const [firstName, ...lastParts] = clientName.trim().split(" ");
    const lastName = lastParts.join(" ") || ".";

    // Read retry count early — needed by the customer-create catch block as
    // well as the payment-create catch further down.
    const retryCount = Number((quote as { payment_retry_count?: number }).payment_retry_count ?? 0);

    // ── 2. Create or find Square Customer ──
    let squareCustomerId: string | undefined;

    try {
      const searchRes = await squareClient.customers.search({
        query: {
          filter: {
            emailAddress: { exact: clientEmail },
          },
        },
      });
      squareCustomerId = searchRes.customers?.[0]?.id;
    } catch {
      // search failed, will create new
    }

    if (!squareCustomerId) {
      try {
        const createRes = await squareClient.customers.create({
          givenName: firstName,
          familyName: lastName,
          emailAddress: clientEmail,
          referenceId: quoteId,
        });
        squareCustomerId = createRes.customer?.id;
      } catch (e) {
        const structured = squareThrownErrorStructured(e);
        console.error(
          `[Square] customer create failed: quote=${quoteId} code=${structured.code ?? "—"} ` +
            `status=${structured.statusCode ?? "?"} detail=${(structured.detail ?? "").slice(0, 200)}`,
        );
        // Persist the failure so the admin notification & retry surface
        // see *something* — earlier this returned 500 silently.
        await supabase
          .from("quotes")
          .update({
            status: "payment_failed",
            payment_error: "Could not set up your Square customer profile. Please contact support.",
            payment_failed_at: new Date().toISOString(),
            payment_retry_count: retryCount + 1,
          })
          .eq("id", quote.id);
        supabase
          .from("webhook_logs")
          .insert({
            source: "payments_process",
            event_type: "customer_create_failed",
            status: "error",
            payload: {
              quoteId,
              clientEmail,
              code: structured.code,
              category: structured.category,
              detail: structured.detail,
              statusCode: structured.statusCode,
              errors: structured.raw,
            },
            error: structured.message.slice(0, 500),
          })
          .then(
            () => {},
            () => {},
          );
        notifyAdmins("payment_failed", {
          quoteId,
          sourceId: quote.id,
          subject: `Square customer create failed — ${quoteId}`,
          description:
            `${quoteId} — ${clientEmail}: customer create failed before payment was attempted.` +
            (structured.code ? ` [code=${structured.code}]` : "") +
            (structured.detail ? `\n\nDetail: ${structured.detail}` : ""),
          clientName,
          excludeRecipientEmails: clientEmail.trim()
            ? [clientEmail.trim().toLowerCase()]
            : [],
        }).catch(() => {});
        return NextResponse.json(
          { error: "Could not set up your payment profile. Please contact support." },
          { status: 500 },
        );
      }
    }

    // ── Idempotency guard: if a previous attempt captured a Square payment but
    //    move creation crashed, skip Square entirely and go straight to job creation.
    //
    // Hardened 2026-06-24 after Diana Osborne (YG-30314): a quote row was
    // born with a STALE square_payment_id belonging to her earlier YG-30266
    // booking (same customer, same card-on-file). The original guard
    // trusted whatever was on the row and short-circuited Square — the
    // $150 deposit was never collected, no admin notification fired, and
    // the activity log made it look like a normal booking.
    //
    // The fix: never trust a row-stored priorPaymentId blindly. Verify
    // with Square that the payment exists AND its reference_id matches
    // THIS quoteId. If the verification fails for any reason (Square 404,
    // mismatched reference, network error), fall through and charge as if
    // priorPaymentId was empty. We'd rather risk a second charge attempt
    // (which Square's own idempotency_key will dedupe inside its own
    // payments service) than skip the charge.
    const priorPaymentIdRaw = (quote as { square_payment_id?: string | null }).square_payment_id;
    let squarePaymentId: string | undefined;
    let squareReceiptUrl: string | null = null;
    let squareCardId: string | undefined = (quote as { square_card_id?: string | null }).square_card_id ?? undefined;
    if (priorPaymentIdRaw) {
      try {
        const verifyRes = await squareClient.payments.get({
          paymentId: priorPaymentIdRaw,
        });
        const refId = (verifyRes.payment as { reference_id?: string | null } | undefined)?.reference_id;
        const status = (verifyRes.payment as { status?: string } | undefined)?.status;
        const validForThisQuote =
          typeof refId === "string" &&
          refId.trim() === quoteId.trim() &&
          (status === "COMPLETED" || status === "APPROVED");
        if (validForThisQuote) {
          squarePaymentId = priorPaymentIdRaw;
          squareReceiptUrl =
            (verifyRes.payment as { receipt_url?: string | null } | undefined)?.receipt_url ?? null;
        } else {
          // Stale payment id pointing at a DIFFERENT quote (or a payment
          // that isn't completed) — scrub it so downstream code doesn't
          // re-write it onto the move and force a fresh charge below.
          console.warn(
            `[payments/process] discarded stale square_payment_id on ${quoteId}: ` +
              `points to reference_id=${refId ?? "—"} status=${status ?? "—"} (must match ${quoteId} + COMPLETED/APPROVED)`,
          );
          await supabase
            .from("quotes")
            .update({ square_payment_id: null })
            .eq("id", quote.id);
        }
      } catch (e) {
        // Square lookup failed (404 = unknown payment, network = transient).
        // Treat as stale and fall through to a fresh charge. The user is
        // about to be charged again, but Square's per-customer idempotency
        // key (built below from quoteId + card) guarantees we won't
        // double-bill if a real prior payment exists with the same key.
        console.warn(
          `[payments/process] square.payments.get failed for prior id ${priorPaymentIdRaw}; treating as stale:`,
          e instanceof Error ? e.message : e,
        );
      }
    }

    if (!squarePaymentId) {
      // ── 3. Store Card on File ──
      // Idempotency key includes a hash of the nonce so that a new nonce (new browser
      // session / retry) gets its own unique card-creation attempt instead of hitting
      // IDEMPOTENCY_KEY_REUSED, which caused the fallthrough-to-raw-nonce double-charge bug.
      const nonceHash = createHash("sha256").update(sourceId).digest("hex").slice(0, 16);
      try {
        const cardRes = await squareClient.cards.create({
          sourceId,
          card: { customerId: squareCustomerId! },
          idempotencyKey: squareIdem("card", quoteId, nonceHash),
        });
        squareCardId = cardRes.card?.id;
      } catch (e) {
        const cardErr = squareThrownErrorStructured(e);
        const isCardTokenUsed = cardErr.code === "CARD_TOKEN_USED";
        console.error(
          `[Square] card storage failed: code=${cardErr.code ?? "—"} ` +
            `category=${cardErr.category ?? "—"} status=${cardErr.statusCode ?? "?"}`,
        );
        // Card create failed — the card may already be on file from a prior session.
        // Fall back to listing the customer's stored cards before giving up.
        if (squareCustomerId) {
          try {
            const listRes = await squareClient.cards.list({ customerId: squareCustomerId });
            squareCardId = (listRes as { cards?: Array<{ id?: string }> }).cards?.[0]?.id;
            if (squareCardId) {
              console.log("[Square] recovered existing card on file:", squareCardId);
            }
          } catch {
            // list also failed — proceed without a stored card
          }
        }
        // Alert admin so we know card storage is broken for this booking.
        // Skip the alert when the failure is CARD_TOKEN_USED — that's a
        // user-retry artifact (Square nonces are single-use, so a second
        // submit with the same nonce will always fail card.create even
        // though the underlying card is fine). The downstream payment
        // attempt will either succeed via the recovered card-on-file or
        // surface its own structured failure with real signal.
        if (!squareCardId && !isCardTokenUsed) {
          notifyAdmins("payment_failed", {
            quoteId,
            sourceId: quoteId,
            subject: "Card storage failed at checkout — no card on file",
            description: `${quoteId} — ${clientEmail}: Square card.create failed and no existing card found. Balance will require manual collection.`,
            clientName,
            excludeRecipientEmails: clientEmail.trim() ? [clientEmail.trim().toLowerCase()] : [],
          }).catch(() => {});
        }
        // Fall through — we can still charge with the nonce directly
      }

      // ── 4. Create Payment ──
      const { locationId } = await getSquarePaymentConfig();
      if (!locationId) {
        return NextResponse.json(
          { error: "Payment is not configured. Please contact support." },
          { status: 503 }
        );
      }
      const paymentSourceId = squareCardId ?? sourceId;
      // When using a stored card, key off the card ID so the same card is always
      // idempotent regardless of retryCount. When falling back to the raw nonce,
      // key off the nonce hash so each unique nonce is idempotent on its own.
      // squareIdem() hashes the key when it would exceed 45 chars (Square's
      // limit) — the previous concatenated form blew the cap whenever a
      // stored card token (`ccof:…`) made the key 48+ chars, producing
      // VALUE_TOO_LONG and a hard payment failure (YG-30240, attempt #3).
      const payIdempotencyKey = squareCardId
        ? squareIdem("pay", quoteId, "card", squareCardId)
        : squareIdem("pay", quoteId, "nonce", nonceHash);

      // Determine if this is a deposit or full payment for the Square note.
      // quote.custom_price is pre-tax; multiply by (1 + tax_rate) to get
      // the inclusive grand total, then compare against what the client paid.
      const _noteCustomPrice = Number(quote.custom_price ?? 0);
      const _noteTaxRate = Number((factors as Record<string, unknown> | null)?.tax_rate ?? 0.13);
      const _noteGrandTotal = _noteCustomPrice > 0
        ? Math.round(_noteCustomPrice * (1 + _noteTaxRate) * 100) / 100
        : 0;
      const _noteIsFullPayment = _noteGrandTotal > 0 && amount >= Math.round(_noteGrandTotal * 0.95);

      try {
        const paymentRes = await squareClient.payments.create({
          sourceId: paymentSourceId,
          amountMoney: { amount: BigInt(amountCents), currency: "CAD" },
          customerId: squareCustomerId,
          referenceId: quoteId,
          note:
            svc === "b2b_oneoff" || svc === "b2b_delivery"
              ? `YUGO B2B delivery payment ${quoteId}`
              : _noteIsFullPayment
                ? `YUGO full payment ${quoteId}`
                : `YUGO deposit ${quoteId}`,
          idempotencyKey: payIdempotencyKey,
          locationId,
        });
        squarePaymentId = paymentRes.payment?.id;
        squareReceiptUrl = (paymentRes.payment as { receipt_url?: string } | null)?.receipt_url ?? null;

        if (!squarePaymentId) {
          return NextResponse.json({ error: "Payment was not completed" }, { status: 500 });
        }

        // Persist payment details on the quote immediately so that if move creation
        // crashes below, a subsequent client retry finds these and skips Square.
        await supabase
          .from("quotes")
          .update({
            square_payment_id: squarePaymentId,
            square_customer_id: squareCustomerId ?? null,
            square_card_id: squareCardId ?? null,
            deposit_amount: amount,
          })
          .eq("id", quote.id);
      } catch (e) {
        // Structured Square error: pull the code, category, statusCode, and
        // raw detail so the catch block has real data to act on. Persist the
        // full payload to webhook_logs for diagnostics and persist the
        // already-created square_customer_id so retries don't keep creating
        // duplicate Square customer profiles.
        const structured = squareThrownErrorStructured(e);
        const msg = structured.message;
        console.error(
          `[Square] payment failed: quote=${quoteId} status=${structured.statusCode ?? "?"} ` +
            `code=${structured.code ?? "—"} category=${structured.category ?? "—"} ` +
            `detail=${(structured.detail ?? "").slice(0, 200)}`,
        );
        const nextRetry = retryCount + 1;
        const failedAt = new Date().toISOString();
        await supabase
          .from("quotes")
          .update({
            status: "payment_failed",
            payment_error: msg,
            payment_failed_at: failedAt,
            payment_retry_count: nextRetry,
            updated_at: failedAt,
            // Persist Square customer + card discovery from the successful
            // pre-payment steps. Without this, a second attempt by the same
            // client creates a duplicate customer in Square — and if the
            // bank later declines again the duplicate makes manual recovery
            // (matching by email) ambiguous.
            ...(squareCustomerId ? { square_customer_id: squareCustomerId } : {}),
            ...(squareCardId ? { square_card_id: squareCardId } : {}),
          })
          .eq("id", quote.id);

        // Full structured error to webhook_logs — admins can search by
        // quote_id and see Square's exact code/category/detail/raw payload
        // even when the customer-facing copy is generic.
        supabase
          .from("webhook_logs")
          .insert({
            source: "payments_process",
            event_type: "payment_failed",
            status: "error",
            payload: {
              quoteId,
              clientEmail,
              squareCustomerId: squareCustomerId ?? null,
              squareCardId: squareCardId ?? null,
              amountCents,
              retryCount: nextRetry,
              statusCode: structured.statusCode,
              code: structured.code,
              category: structured.category,
              detail: structured.detail,
              errors: structured.raw,
            },
            error: msg.slice(0, 500),
          })
          .then(
            () => {},
            () => {},
          );

        // CARD_TOKEN_USED is a user-retry artifact, not an operational
        // alert: Square nonces are single-use, so a double-click on Pay or
        // a network retry hits this code with no real signal for admin to
        // act on. The webhook_logs row above still captures the full
        // structured error for diagnostics. We also peek at the quotes
        // row to see if a prior attempt already captured a payment — if
        // so this retry is harmless noise.
        const { data: paymentCheckQuote } = await supabase
          .from("quotes")
          .select("square_payment_id, status")
          .eq("id", quote.id)
          .maybeSingle();
        const priorPaymentExists =
          typeof paymentCheckQuote?.square_payment_id === "string" &&
          paymentCheckQuote.square_payment_id.trim().length > 0;
        const shouldAlertAdmin =
          structured.code !== "CARD_TOKEN_USED" && !priorPaymentExists;

        if (shouldAlertAdmin) notifyAdmins("payment_failed", {
          quoteId,
          sourceId: quote.id,
          subject: structured.code
            ? `Quote payment failed — ${structured.code}`
            : "Quote payment failed",
          // Surface the structured code + Square detail so the admin email
          // identifies whether it's a bank decline, an SDK timeout, or a
          // config issue — not just the generic client-facing copy.
          description:
            `${quoteId} — ${clientEmail}: ${msg}` +
            (structured.code ? ` [code=${structured.code}]` : "") +
            (structured.category ? ` [category=${structured.category}]` : "") +
            (structured.statusCode ? ` [status=${structured.statusCode}]` : "") +
            (structured.detail ? `\n\nDetail: ${structured.detail}` : "") +
            (nextRetry > 1 ? `\n\nAttempt #${nextRetry}` : ""),
          clientName: clientName,
          excludeRecipientEmails: clientEmail.trim()
            ? [clientEmail.trim().toLowerCase()]
            : [],
        }).catch(() => {});

        // Same noise-suppression for the client-facing failure email — when
        // a prior attempt already captured a payment and the only failure
        // is CARD_TOKEN_USED, we don't want to confuse the client by
        // telling them their payment failed.
        if (!shouldAlertAdmin) {
          // Skip the client failure email; the prior successful payment
          // remains valid and the booking flow continues normally on the
          // client's next refresh.
          return NextResponse.json(
            {
              ok: true,
              quoteId,
              squarePaymentId: priorPaymentExists
                ? paymentCheckQuote?.square_payment_id
                : null,
              code: structured.code,
              note: "Existing payment found; retry skipped.",
            },
            { status: 200 },
          );
        }

        const firstPayName = clientName.trim().split(/\s+/)[0] || "there";
        buildPaymentFailedClientEmailHtml({
          firstName: firstPayName,
          quoteId,
          friendlyReason: msg,
        })
          .then((html) =>
            sendEmail({
              to: clientEmail,
              subject: "We could not process your payment — quick fix needed",
              html,
            }),
          )
          .catch(() => {});

        const remindAt = new Date();
        remindAt.setHours(remindAt.getHours() + 24);
        const { data: existingRem } = await supabase
          .from("scheduled_emails")
          .select("id")
          .eq("quote_id", quote.id)
          .eq("type", "payment_retry_reminder")
          .eq("status", "pending")
          .limit(1);
        if (!existingRem?.length) {
          await supabase.from("scheduled_emails").insert({
            quote_id: quote.id,
            type: "payment_retry_reminder",
            scheduled_for: remindAt.toISOString(),
            status: "pending",
          });
        }

        return NextResponse.json({ error: msg }, { status: 402 });
      }
    } // end if (!priorPaymentId)

    const svcType = String(quote.service_type ?? "");
    const isB2bPay = isB2BDeliveryQuoteServiceType(svcType);

    let moveId: string | null = null;
    let moveCode: string | null = null;
    let deliveryId: string | null = null;
    let deliveryNumber: string | null = null;
    let trackingUrl: string | null = null;

    try {
      if (isB2bPay) {
        const d = await createDeliveryFromB2BQuote({
          quoteId,
          depositAmount: amount,
          selectedTier: selectedTier ?? null,
          selectedAddons: selectedAddons ?? [],
          clientName,
          clientEmail,
          squareCustomerId,
          squareCardId,
          squarePaymentId,
          squareReceiptUrl,
        });
        deliveryId = d.deliveryId;
        deliveryNumber = d.deliveryNumber;
        const { trackingToken } = await issueDeliveryTrackingTokens(deliveryId);
        await sendB2BTrackingNotifications(deliveryId);
        const base = getEmailBaseUrl().replace(/\/$/, "");
        trackingUrl = `${base}/delivery/track/${encodeURIComponent(trackingToken)}`;
      } else {
        const moveResult = await createMoveFromQuote({
          quoteId,
          depositAmount: amount,
          selectedTier: selectedTier ?? null,
          selectedAddons: selectedAddons ?? [],
          clientName,
          clientEmail,
          squareCustomerId,
          squareCardId,
          squarePaymentId,
          squareReceiptUrl,
        });
        moveId = moveResult.moveId;
        moveCode = moveResult.moveCode;
      }

      // ── 5. Update quote → accepted (only after successful move/delivery creation) ──
      await supabase
        .from("quotes")
        .update({
          status: "accepted",
          selected_tier: selectedTier ?? null,
          accepted_at: new Date().toISOString(),
          selected_addons: selectedAddons ?? [],
          payment_error: null,
          payment_failed_at: null,
        })
        .eq("id", quote.id);
    } catch (jobErr) {
      // Square took the money but the move/delivery row couldn't be
      // inserted. Until 2026-06-29 this catch silently returned 500 with
      // a "contact support" message -- which led the customer to retry
      // the Pay button, charging Square AGAIN since priorPaymentIdRaw
      // verification can only catch a payment that's already settled and
      // persisted (Jenny Belanger YG-30337 hit this and was double-
      // charged $283 because the deliveries.created_by_source CHECK
      // constraint rejected 'quote' for every B2B one-off booking).
      //
      // New behavior:
      //  1. Persist square_payment_id on the quote so a retry by the
      //     same client finds it and SKIPS the second Square charge.
      //  2. Write a payments_process:post_payment_job_failed row to
      //     webhook_logs with the full error so an admin sees the
      //     failure in the diagnostics surface (instead of an opaque
      //     500 we have to root-cause from Square webhooks alone).
      //  3. Notify admin so manual recovery can run (the
      //     /api/admin/quotes/recover-move endpoint already exists for
      //     this).
      const errMsg = jobErr instanceof Error ? jobErr.message : String(jobErr);
      console.error("[payments/process] job creation failed:", jobErr);

      if (squarePaymentId) {
        await supabase
          .from("quotes")
          .update({ square_payment_id: squarePaymentId })
          .eq("id", quote.id)
          .then(
            () => {},
            () => {},
          );
      }

      await supabase
        .from("webhook_logs")
        .insert({
          source: "payments_process",
          event_type: "post_payment_job_failed",
          status: "error",
          payload: {
            quoteId,
            clientEmail,
            squarePaymentId: squarePaymentId ?? null,
            squareCustomerId: squareCustomerId ?? null,
            squareCardId: squareCardId ?? null,
            amountCents,
            isB2bPay,
            jobErrorMessage: errMsg.slice(0, 500),
          },
          error: errMsg.slice(0, 500),
        })
        .then(
          () => {},
          () => {},
        );

      notifyAdmins("payment_failed", {
        quoteId,
        sourceId: quote.id,
        subject: isB2bPay
          ? "B2B delivery creation failed AFTER successful payment"
          : "Move creation failed AFTER successful payment",
        description:
          `${quoteId} — ${clientEmail}: Square accepted payment ` +
          `${squarePaymentId ?? "(unknown id)"} for $${amount.toLocaleString()} ` +
          `but ${isB2bPay ? "delivery" : "move"} row insert threw:\n\n${errMsg}\n\n` +
          `Run /api/admin/quotes/recover-move or fix the underlying DB error.`,
        clientName,
        excludeRecipientEmails: clientEmail.trim() ? [clientEmail.trim().toLowerCase()] : [],
      }).catch(() => {});

      return NextResponse.json(
        {
          error: isB2bPay
            ? "Payment was processed but delivery creation failed. Please contact support with your quote ID."
            : "Payment was processed but move creation failed. Please contact support with your quote ID.",
        },
        { status: 500 },
      );
    }

    // ── 7. Log to activity feed ──
    await logActivity({
      entity_type: "quote",
      entity_id: quoteId,
      event_type: "accepted",
      description: `Quote accepted by ${clientName}, $${amount.toLocaleString()} paid (${quoteId})`,
      icon: "payment",
    });

    // ── 8. Post-payment actions (fire-and-forget) ──
    // Run the post-payment action chain INSIDE `after()` so Vercel keeps
    // the serverless function alive long enough for HubSpot patch + emails
    // + crew assignment to actually complete. The original fire-and-forget
    // pattern (`.catch(...)`) returned the response, Vercel terminated the
    // function, and any action that hadn't finished yet died mid-execution
    // — leaving empty HubSpot Details cards on every successful checkout.
    if (isB2bPay && deliveryId && deliveryNumber && squarePaymentId) {
      const capturedDeliveryId = deliveryId;
      const capturedDeliveryNumber = deliveryNumber;
      const capturedPaymentId = squarePaymentId;
      after(async () => {
        try {
          await runPostPaymentActionsB2BDelivery({
            quoteId,
            deliveryId: capturedDeliveryId,
            deliveryNumber: capturedDeliveryNumber,
            paymentId: capturedPaymentId,
            amount,
          });
        } catch (err) {
          console.error("[postPayment B2B delivery] error:", err);
        }
      });
    } else if (moveId && moveCode && squarePaymentId) {
      const capturedMoveId = moveId;
      const capturedMoveCode = moveCode;
      const capturedPaymentId = squarePaymentId;
      after(async () => {
        try {
          await runPostPaymentActions({
            quoteId,
            moveId: capturedMoveId,
            moveCode: capturedMoveCode,
            paymentId: capturedPaymentId,
            amount,
          });
        } catch (err) {
          console.error("[postPayment] error:", err);
        }
      });
    }

    return NextResponse.json({
      success: true,
      payment_id: squarePaymentId,
      move_id: moveId,
      delivery_id: deliveryId,
      tracking_url: isB2bPay
        ? trackingUrl
        : moveCode
          ? `/track/move/${moveCode}`
          : null,
    });
  } catch (e) {
    console.error("[payments/process] unexpected error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
