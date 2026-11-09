import { z } from "zod";
import { rankMatches, type MatchResult } from "./match";
import { PEOPLE } from "./people";
import { getSnapshot } from "./snapshot";
import { FNS, PERSON_KEYS, type Profile } from "./types";

export const matchBodySchema = z.object({
  intake: z.object({
    targets: z.array(z.enum(FNS)).max(7),
    places: z.array(z.string().max(60)).max(8),
    why: z.string().max(400),
    seniority: z.enum(["intern", "new_grad"]).optional(),
    founding: z.boolean().optional(),
  }),
  personKey: z.enum(PERSON_KEYS),
});

export type MatchOutcome =
  | { status: 200; body: { profile: Profile; result: MatchResult } }
  | { status: 400; body: { error: string } };

// Ranking runs here only: the corpus is too big for the client bundle.
export function handleMatch(raw: unknown): MatchOutcome {
  const parsed = matchBodySchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "bad_input" } };
  const { intake, personKey } = parsed.data;
  const profile = PEOPLE[personKey].profile;
  return { status: 200, body: { profile, result: rankMatches(profile, intake, getSnapshot()) } };
}
