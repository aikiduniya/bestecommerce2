import { describe, expect, it } from "vitest";
import { isHostTwin, normalizeSiteUrl, resolveSiteUrl } from "./site-url";

describe("site url", () => {
  it("forces https and strips paths/trailing slash", () => {
    expect(normalizeSiteUrl("http://Shop.Example.com/foo/")).toBe("https://shop.example.com");
    expect(normalizeSiteUrl("www.example.com")).toBe("https://www.example.com");
  });
  it("rejects junk", () => {
    expect(normalizeSiteUrl("not a url")).toBeNull();
    expect(normalizeSiteUrl("")).toBeNull();
  });
  it("admin setting wins over env and request origin", () => {
    expect(resolveSiteUrl("example.com", "https://env.com", "https://req.com")).toBe("https://example.com");
    expect(resolveSiteUrl(null, "https://env.com", "https://req.com")).toBe("https://env.com");
    expect(resolveSiteUrl(null, undefined, "https://req.com/")).toBe("https://req.com");
  });
  it("detects www twins only", () => {
    expect(isHostTwin("www.example.com", "example.com")).toBe(true);
    expect(isHostTwin("example.com", "example.com")).toBe(false);
    expect(isHostTwin("foo.lovable.app", "example.com")).toBe(false);
  });
});
