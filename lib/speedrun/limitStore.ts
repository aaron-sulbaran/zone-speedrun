export type LimitStore = { url: string; token: string };

const PAIRS = [
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
] as const;

/** One whole pair or nothing: a half-set pair never configures the store. */
export function limitStore(env: Record<string, string | undefined>): LimitStore | null {
  for (const [urlName, tokenName] of PAIRS) {
    const url = env[urlName]?.trim();
    const token = env[tokenName]?.trim();
    if (url && token && url.startsWith("https://")) return { url, token };
  }
  return null;
}
