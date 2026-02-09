import crypto from "crypto";

const PADDLE_API_KEY = process.env.PADDLE_API_KEY;
const PADDLE_ENVIRONMENT = process.env.PADDLE_ENVIRONMENT || "sandbox";

const PADDLE_API_BASE =
  PADDLE_ENVIRONMENT === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";

function getPaddleHeaders() {
  if (!PADDLE_API_KEY) {
    throw new Error("PADDLE_API_KEY not configured");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${PADDLE_API_KEY}`,
  };
}

async function paddleFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PADDLE_API_BASE}${path}`, {
    ...options,
    headers: {
      ...getPaddleHeaders(),
      ...(options.headers || {}),
    },
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Paddle API error ${response.status}: ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : ({} as T);
}

function extractCheckoutUrl(payload: any): string | null {
  return (
    payload?.data?.checkout?.url ||
    payload?.data?.checkout_url ||
    payload?.data?.url ||
    payload?.checkout?.url ||
    payload?.checkout_url ||
    payload?.url ||
    null
  );
}

export async function createCheckout(options: {
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl?: string;
  customData?: Record<string, string>;
}) {
  const payload: Record<string, any> = {
    items: [{ price_id: options.priceId, quantity: 1 }],
    success_url: options.successUrl,
  };

  if (options.cancelUrl) {
    payload.cancel_url = options.cancelUrl;
  }

  if (options.customerId) {
    payload.customer_id = options.customerId;
  } else if (options.customerEmail) {
    payload.customer_email = options.customerEmail;
  }

  if (options.customData) {
    payload.custom_data = options.customData;
  }

  const response = await paddleFetch<any>("/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const checkoutUrl = extractCheckoutUrl(response);
  if (!checkoutUrl) {
    throw new Error("No checkout URL returned by Paddle");
  }

  return { checkoutUrl, transaction: response?.data || response };
}

export async function createOneTimeCharge(options: {
  subscriptionId: string;
  priceId: string;
  customData?: Record<string, string>;
}) {
  const payload: Record<string, any> = {
    subscription_id: options.subscriptionId,
    items: [{ price_id: options.priceId, quantity: 1 }],
  };

  if (options.customData) {
    payload.custom_data = options.customData;
  }

  return paddleFetch<any>("/transactions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listPaymentMethods(customerId: string) {
  return paddleFetch<any>(`/customers/${customerId}/payment-methods`);
}

export async function createCustomerPortalSession(customerId: string, returnUrl?: string) {
  const payload: Record<string, any> = {};
  if (returnUrl) {
    payload.return_url = returnUrl;
  }

  return paddleFetch<any>(`/customers/${customerId}/portal-session`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function cancelSubscription(subscriptionId: string) {
  return paddleFetch<any>(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function verifyWebhookSignature(payload: string, signatureHeader: string | null) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("PADDLE_WEBHOOK_SECRET not set, skipping verification");
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.trim().split("=");
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  const timestamp = parts.ts;
  const signature = parts.h1;

  if (!timestamp || !signature) {
    return false;
  }

  const signedPayload = `${timestamp}:${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
