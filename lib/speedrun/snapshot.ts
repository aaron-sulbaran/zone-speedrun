import { z } from "zod";
import raw from "./snapshot.json";

const companySchema = z.object({
  slug: z.string(),
  name: z.string(),
  cohort: z.string().nullable(),
  stage: z.string().nullable(),
  blurb: z.string(),
  location: z.string().nullable(),
  remotePolicy: z.string().nullable(),
  functions: z.array(z.string()),
  openRoles: z.number(),
  logo: z.string().nullable(),
  url: z.string(),
});

const roleSchema = z.object({
  id: z.string(),
  company: z.string(),
  companySlug: z.string().nullable(),
  title: z.string(),
  location: z.string().nullable(),
  workplace: z.string().nullable(),
  fn: z.string().nullable(),
  seniority: z.string().nullable(),
  tier: z.enum(["speedrun", "a16z", "market"]),
  cohort: z.string().nullable(),
  compMin: z.number().nullable(),
  compMax: z.number().nullable(),
  compPeriod: z.string().nullable(),
  postedAt: z.string(),
  url: z.string(),
  excerpt: z.string(),
  levelHints: z.array(z.string()).default([]),
  descriptionRead: z.boolean().default(false),
});

const portfolioNameSchema = z.object({ name: z.string(), sector: z.string() });

export const snapshotSchema = z.object({
  fetchedAt: z.string(),
  companies: z.array(companySchema),
  roles: z.array(roleSchema),
  portfolio: z.array(portfolioNameSchema),
});

export type SnapshotCompany = z.infer<typeof companySchema>;
export type SnapshotRole = z.infer<typeof roleSchema>;
export type PortfolioName = z.infer<typeof portfolioNameSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;

let cached: Snapshot | null = null;

export function getSnapshot(): Snapshot {
  cached ??= snapshotSchema.parse(raw);
  return cached;
}
