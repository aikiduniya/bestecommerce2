import { describe, expect, it } from "vitest";
import { toMinor, verifyStripeSignature } from "@/lib/stripe.server";

async function sign(body: string, secret: string, t: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return `t=${t},v1=${Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

describe("stripe webhook signature", () => {
  const body = '{"id":"evt_1"}';
  const now = Math.floor(Date.now() / 1000);
  it("accepts a correctly signed payload", async () => {
    expect(await verifyStripeSignature(body, await sign(body, "whsec_abc", now), "whsec_abc")).toBe(true);
  });
  it("rejects a wrong secret", async () => {
    expect(await verifyStripeSignature(body, await sign(body, "whsec_other", now), "whsec_abc")).toBe(false);
  });
  it("rejects a tampered body", async () => {
    expect(await verifyStripeSignature('{"id":"evt_2"}', await sign(body, "whsec_abc", now), "whsec_abc")).toBe(false);
  });
  it("rejects a replay older than 5 minutes", async () => {
    expect(await verifyStripeSignature(body, await sign(body, "whsec_abc", now - 301), "whsec_abc")).toBe(false);
  });
});

describe("amount conversion", () => {
  it("uses cents for USD", () => expect(toMinor(19.99, "USD")).toBe(1999));
  it("uses whole units for JPY", () => expect(toMinor(1500, "JPY")).toBe(1500));
});
