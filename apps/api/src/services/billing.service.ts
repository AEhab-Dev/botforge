import Stripe from "stripe";
import { db } from "../db/client.js";
import { subscriptions, workspaces } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

// ─── Stripe client ────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

// ─── Plan definitions ─────────────────────────────────────────────────────────

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: null as null,
    botLimit: 1,
    features: [
      "1 bot",
      "Welcome messages",
      "Auto-roles",
      "Custom commands",
      "Basic moderation",
      "Community support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9,
    interval: "month" as const,
    botLimit: 5,
    features: [
      "Up to 5 bots",
      "All free features",
      "Twitch notifications",
      "YouTube notifications",
      "Scheduled announcements",
      "Ticket system",
      "Priority support",
      "Longer log retention",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 29,
    interval: "month" as const,
    botLimit: 20,
    features: [
      "Up to 20 bots",
      "All Pro features",
      "Custom branding",
      "Team collaboration",
      "SLA support",
      "API access",
      "Audit logs",
      "SSO / SAML",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get or create the subscription row for a workspace */
export async function getOrCreateSubscription(workspaceId: string) {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, workspaceId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(subscriptions)
    .values({ workspaceId, planId: "free", status: "active" })
    .returning();

  return created!;
}

/** Get the workspace a user owns */
export async function getOwnedWorkspace(userId: string) {
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1);
  return ws ?? null;
}

// ─── Checkout ─────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  workspaceId: string,
  planId: "pro" | "business",
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
) {
  const stripe = getStripe();
  const sub = await getOrCreateSubscription(workspaceId);

  const priceIdKey =
    planId === "pro" ? "STRIPE_PRO_PRICE_ID" : "STRIPE_BUSINESS_PRICE_ID";
  const priceId = process.env[priceIdKey];
  if (!priceId) throw new Error(`${priceIdKey} is not configured`);

  // Reuse existing Stripe customer or let Stripe create one
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { workspaceId, planId },
    subscription_data: { metadata: { workspaceId, planId } },
  };

  if (sub.providerCustomerId) {
    sessionParams.customer = sub.providerCustomerId;
  } else {
    sessionParams.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  return session;
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function createPortalSession(
  workspaceId: string,
  returnUrl: string
) {
  const stripe = getStripe();
  const sub = await getOrCreateSubscription(workspaceId);

  if (!sub.providerCustomerId) {
    throw new Error("No Stripe customer found. Subscribe to a plan first.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.providerCustomerId,
    return_url: returnUrl,
  });

  return session;
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

export async function handleWebhook(payload: Buffer, signature: string) {
  const stripe = getStripe();
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    throw new Error("Invalid webhook signature");
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      const planId = session.metadata?.planId;
      if (!workspaceId || !planId) break;

      await db
        .update(subscriptions)
        .set({
          providerCustomerId: session.customer as string,
          providerSubscriptionId: session.subscription as string,
          planId,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const workspaceId = stripeSub.metadata?.workspaceId;
      if (!workspaceId) break;

      const planId = stripeSub.metadata?.planId ?? "free";
      const status = stripeSub.status === "active" ? "active" : "past_due";
      const periodEnd = new Date(stripeSub.current_period_end * 1000);
      const periodStart = new Date(stripeSub.current_period_start * 1000);

      await db
        .update(subscriptions)
        .set({
          planId,
          status,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const workspaceId = stripeSub.metadata?.workspaceId;
      if (!workspaceId) break;

      await db
        .update(subscriptions)
        .set({
          planId: "free",
          status: "canceled",
          providerSubscriptionId: null,
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.workspaceId, workspaceId));
      break;
    }
  }

  return { received: true };
}
