import type { AppRow } from "./types";

// The two identities a brief line carries. Kept here, with no imports of content or the matcher,
// so the brief's API route and the client both read the very same formulas.

/** A row's identity inside a brief line's `actionKey`. */
export const rowKey = (row: Pick<AppRow, "company" | "role">) => `${row.company}:${row.role ?? "-"}`;

/** The Matches tab's key for a match: its company's display name and the role id (`company` for a company-only match). */
export const roleMatchKey = (companyName: string, roleId: string | null) => `${companyName}-${roleId ?? "company"}`;
