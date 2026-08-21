import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkoutResourceId: vi.fn((value: unknown) => typeof value === "string" ? value : null),
  upsertStripeSubscriptionReference: vi.fn(),
  verifyStripeWebhook: vi.fn(),
}));

vi.mock("./billing", () => ({
  checkoutResourceId: mocks.checkoutResourceId,
  verifyStripeWebhook: mocks.verifyStripeWebhook,
}));

vi.mock("../db", () => ({
  upsertStripeSubscriptionReference: mocks.upsertStripeSubscriptionReference,
}));

import { registerStripeWebhook } from "./webhooks";

function createResponse() {
  const response = {
    json: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function createHandler() {
  let handler: ((req: any, res: any) => Promise<unknown>) | undefined;
  registerStripeWebhook({ post: vi.fn((_path: string, callback: typeof handler) => { handler = callback; }) } as any);
  if (!handler) throw new Error("Webhook Stripe não foi registrado.");
  return handler;
}

describe("webhook Stripe anual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconhece o evento de teste verificado sem gravar assinatura", async () => {
    mocks.verifyStripeWebhook.mockReturnValue({ id: "evt_test_checkout", type: "checkout.session.completed", data: { object: {} } });
    const response = createResponse();
    await createHandler()({ body: Buffer.from("{}"), header: vi.fn(() => "sig") }, response);
    expect(response.json).toHaveBeenCalledWith({ verified: true });
    expect(mocks.upsertStripeSubscriptionReference).not.toHaveBeenCalled();
  });

  it("persiste somente os identificadores mínimos de checkout associado ao workspace", async () => {
    mocks.verifyStripeWebhook.mockReturnValue({
      id: "evt_live_checkout",
      type: "checkout.session.completed",
      data: { object: { customer: "cus_123", subscription: "sub_456", metadata: { workspace_owner_id: "7", client_id: "3", plan_id: "9" } } },
    });
    const response = createResponse();
    await createHandler()({ body: Buffer.from("{}"), header: vi.fn(() => "sig") }, response);
    expect(mocks.upsertStripeSubscriptionReference).toHaveBeenCalledWith({
      ownerUserId: 7,
      clientId: 3,
      planId: 9,
      stripeCustomerId: "cus_123",
      externalSubscriptionId: "sub_456",
      stripePriceId: null,
      status: "active",
    });
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });
});
