// The brief email goes only to addresses on Aaron's list. Entries are `local@domain`
// (one address) or `@domain` (anyone at exactly that domain). No wildcards, no subdomains.

const ADDRESS = /^[^\s@,]+@[^\s@,]+$/;
const DOMAIN = /^@[^\s@,]+$/;

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => !entry.includes("*") && (ADDRESS.test(entry) || DOMAIN.test(entry)));
}

export function isAllowed(email: string, list: string[]): boolean {
  const address = email.trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return false;
  const domain = address.slice(at);
  return list.some((entry) => entry === address || entry === domain);
}
