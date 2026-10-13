import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import {
  PLANS,
  getOrCreateSubscription,
  getOwnedWorkspace,
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
} from "../services/billing.service.js";

export const billingRoutes = new Hono();

// Webhook endpoint must be raw — no auth, no JSON parsing
billingRoutes.post("/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "Missing stripe-signature" }, 400);

  const payload = Buffer.from(await c.req.arrayBuffer());

  try {
    const result = await handleWebhook(payload, sig);
    return c.json(result);
  } catch (err: any) {
    console.error("Stripe webhook error:", err.message);
    return c.json({ error: err.message }, 400);
  }
});

// All routes below require authentication
billingRoutes.use("*", requireAuth);

// ─── GET /api/v1/billing ──────────────────────────────────────────────────────
// Returns current subscription + plan info

billingRoutes.get("/", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const sub = await getOrCreateSubscription(ws.id);
  const planId = (sub.planId ?? "free") as keyof typeof PLANS;
  const plan = PLANS[planId] ?? PLANS.free;

  return c.json({
    subscription: sub,
    plan,
    plans: Object.values(PLANS),
  });
});

// ─── POST /api/v1/billing/checkout ───────────────────────────────────────────
// Create a Stripe Checkout session and return the URL

billingRoutes.post("/checkout", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const body = await c.req.json().catch(() => null);
  const planId = body?.planId as string;

  if (planId !== "pro" && planId !== "business") {
    return c.json({ error: "INVALID_PLAN", message: "planId must be 'pro' or 'business'" }, 400);
  }

  const appBase = process.env["APP_BASE_URL"] ?? "http://localhost:3000";

  try {
    const session = await createCheckoutSession(
      ws.id,
      planId,
      user.email,
      `${appBase}/billing?success=1`,
      `${appBase}/billing?canceled=1`
    );
    return c.json({ url: session.url });
  } catch (err: any) {
    console.error("Checkout error:", err.message);
    return c.json({ error: "CHECKOUT_FAILED", message: err.message }, 500);
  }
});

// ─── POST /api/v1/billing/portal ─────────────────────────────────────────────
// Create a Stripe customer portal session

billingRoutes.post("/portal", async (c) => {
  const user = c.get("user");
  const ws = await getOwnedWorkspace(user.id);
  if (!ws) return c.json({ error: "NOT_FOUND" }, 404);

  const appBase = process.env["APP_BASE_URL"] ?? "http://localhost:3000";

  try {
    const session = await createPortalSession(ws.id, `${appBase}/billing`);
    return c.json({ url: session.url });
  } catch (err: any) {
    console.error("Portal error:", err.message);
    return c.json({ error: "PORTAL_FAILED", message: err.message }, 500);
  }
});
