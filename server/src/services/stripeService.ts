export interface CheckoutSession {
  id: string;
  url: string;
}

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface TrialStatus {
  isExpired: boolean;
  daysRemaining: number;
  plan: string;
}

export async function createCheckoutSession(userId: string, email: string): Promise<CheckoutSession> {
  const sessionId = `mock_cs_${userId}_${Date.now()}`;
  console.log(`[Stripe Mock] createCheckoutSession for ${email}`);
  return {
    id: sessionId,
    url: `https://checkout.stripe.com/pay/${sessionId}#mock`,
  };
}

export async function handleWebhook(event: WebhookEvent): Promise<{ handled: boolean }> {
  switch (event.type) {
    case "checkout.session.completed":
      console.log("[Stripe Mock] checkout.session.completed", event.data);
      return { handled: true };
    case "customer.subscription.deleted":
      console.log("[Stripe Mock] customer.subscription.deleted", event.data);
      return { handled: true };
    case "invoice.payment_failed":
      console.log("[Stripe Mock] invoice.payment_failed", event.data);
      return { handled: true };
    default:
      return { handled: false };
  }
}

export function checkTrialStatus(trialEndsAt: Date, plan: string): TrialStatus {
  if (plan === "pro") {
    return { isExpired: false, daysRemaining: 0, plan };
  }
  const now = new Date();
  const msRemaining = trialEndsAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  return {
    isExpired: daysRemaining === 0,
    daysRemaining,
    plan,
  };
}
