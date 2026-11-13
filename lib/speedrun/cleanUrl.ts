/** The snapshot's role links carry agent tracking; a person's click is not agent traffic, so every link a person can click drops the utm_ tags. */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    [...parsed.searchParams.keys()].filter((key) => key.startsWith("utm_")).forEach((key) => parsed.searchParams.delete(key));
    return parsed.toString();
  } catch {
    return url;
  }
}
