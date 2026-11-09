import { describe, expect, it } from "vitest";
import { limitStore } from "./limitStore";

describe("limitStore", () => {
  it("reads the KV pair", () => {
    expect(limitStore({ KV_REST_API_URL: "https://u.example", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://u.example", token: "t" });
  });
  it("reads the UPSTASH pair", () => {
    expect(limitStore({ UPSTASH_REDIS_REST_URL: "https://u2.example", UPSTASH_REDIS_REST_TOKEN: "t2" })).toEqual({ url: "https://u2.example", token: "t2" });
  });
  it("is null for a URL without a token", () => {
    expect(limitStore({ KV_REST_API_URL: "https://u.example" })).toBeNull();
    expect(limitStore({ KV_REST_API_URL: "https://u.example", KV_REST_API_TOKEN: "" })).toBeNull();
  });
  it("is null for none", () => {
    expect(limitStore({})).toBeNull();
  });
  it("prefers KV when both are set", () => {
    expect(
      limitStore({ KV_REST_API_URL: "https://u.example", KV_REST_API_TOKEN: "t", UPSTASH_REDIS_REST_URL: "https://u2.example", UPSTASH_REDIS_REST_TOKEN: "t2" }),
    ).toEqual({ url: "https://u.example", token: "t" });
  });
  it("never mixes halves of two pairs", () => {
    expect(limitStore({ KV_REST_API_URL: "https://u.example", UPSTASH_REDIS_REST_TOKEN: "t2" })).toBeNull();
  });
});

describe("limitStore urls", () => {
  it("accepts only trimmed https URLs", () => {
    expect(limitStore({ KV_REST_API_URL: " https://a.example \n", KV_REST_API_TOKEN: "t" })).toEqual({ url: "https://a.example", token: "t" });
    expect(limitStore({ KV_REST_API_URL: "http://a.example", KV_REST_API_TOKEN: "t" })).toBeNull();
  });
});
