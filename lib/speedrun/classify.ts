import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const JOB_CONTEXT = /\b(application|candidate|position|role)\b/;
// Words that tie a message to the reader's own application, so a newsletter
// that merely mentions an interview or an assessment stays "other".
const APPLICATION_CONTEXT =
  /\b(your application|your candidacy|you applied|applied for|applying|the [\w ,&'-]{2,40} (role|position)|this (role|position))\b|^role:/m;

const OFFER = /pleased to offer|would like to offer you|offer letter|extend (you )?an offer|offer of employment/;
const NEGATED_OFFER =
  /\b(not|unable|n't)\s+(be\s+)?(able\s+)?(to\s+)?(extend|extending|make|making|offer|offering)\b|\bcannot\s+(extend|offer)\b/;
const REJECTION =
  /regret to inform|not (be )?moving forward|will not be proceeding|(pursue|pursuing|move forward with|moving forward with|proceed with|proceeding with) (other|another|different) (candidates?|applicants?)|decided to (move|go|pursue) .{0,30}(other|another)/;
const ASSESSMENT = /take-home|coding challenge|online coding test|online assessment|assessment|hackerrank|codesignal|technical exercise/;
const INTERVIEW_SCHEDULING =
  /interview (invitation|with|slot|scheduled|time)|invite you to .{0,30}interview|(reschedule|move|schedule|confirm) .{0,20}interview|your interview/;
const INTERVIEW_ANYWHERE = /final round|onsite|partner meeting|pitch session/;
const SCREEN = /phone screen|intro call|recruiter call|quick call|screening call/;
const INTRO = /introducing you|introduce you|wanted to introduce|introduction:|warm intro|intro:/;
const APPLIED = /thanks for applying|thank you for applying|received your application|application (was |has been )?(received|submitted)|application confirmation/;

const SENDER_SUFFIX = /\s+(careers|talent team|talent|hiring team|hiring|jobs|people team|people|founders|team)$/i;
const SENDER_PREFIX = /^(hiring at|careers at|founders at|team at|jobs at)\s+/i;
const GENERIC_LOCAL = /noreply|no-reply|careers|jobs|hiring|talent|apply|team|hello|info|news|support|people|notification/i;
const VENDORS = /(^|[^a-z])(greenhouse|lever|ashby|workday|hackerrank|codesignal)/i;
const GENERIC_MAIL = /^(gmail|outlook|yahoo|icloud|hotmail|proton|protonmail)\./i;
const DIGEST_SENDER = /linkedin|indeed|glassdoor|jobalert|digest|newsletter/i;
const CALENDAR_SENDER = /calendar/i;
const FOUNDER_WORDS = /\baccelerator|\bventures?\b|\bfund\b|\bfounders?\b|\bpre-seed\b|\bdemo day\b|\bcohort\b|\bpitch\b|\bbatch\b/i;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function parseSender(from: string): { display: string; local: string; domain: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const display = match ? match[1].trim() : "";
  const address = match ? match[2] : from.trim();
  const [local = "", domain = ""] = address.split("@");
  return { display, local, domain };
}

function companyFromText(email: InboxEmail): string | null {
  const pattern = /\b(?:at|to|with|from)\s+([A-Z][\w&'-]*(?:\s+[A-Z][\w&'-]*){0,3})/;
  return email.subject.match(pattern)?.[1] ?? email.body.match(pattern)?.[1] ?? null;
}

function companyFrom(email: InboxEmail): string {
  const { display, local, domain } = parseSender(email.from);
  const stripped = display.replace(SENDER_PREFIX, "").replace(SENDER_SUFFIX, "").trim();
  const personLike =
    /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/.test(display) && stripped === display && !GENERIC_LOCAL.test(local);
  if (stripped && !personLike && !VENDORS.test(display)) return stripped;
  if (domain && !VENDORS.test(domain) && !GENERIC_MAIL.test(domain)) {
    const parts = domain.split(".");
    return capitalize(parts.length >= 2 ? parts[parts.length - 2] : parts[0]);
  }
  return companyFromText(email) ?? (stripped || capitalize(domain.split(".")[0] || "Unknown"));
}

function roleFrom(email: InboxEmail): string | null {
  const line = email.body.match(/^Role:\s*(.+)$/m);
  if (line) return line[1].trim();
  const subject = email.subject.match(/\b(?:applying|application) for (?:the )?(.+?)(?: role| position)? at\b/i);
  return subject ? subject[1].trim() : null;
}

function kindOf(email: InboxEmail): EventKind {
  const text = `${email.subject}\n${email.body}`.toLowerCase();
  const subject = email.subject.toLowerCase();
  const { display, domain } = parseSender(email.from);
  const sender = `${display} ${email.from}`;

  if (CALENDAR_SENDER.test(sender)) return "other";
  if (DIGEST_SENDER.test(sender) && !/your application|applying/.test(subject)) return "other";

  if (/\boffer/.test(text) && NEGATED_OFFER.test(text)) return "rejection";
  if (OFFER.test(text)) return "offer";
  if (REJECTION.test(text)) return "rejection";
  if (/\bunfortunately\b/.test(text) && JOB_CONTEXT.test(text) && !/reschedul|move your interview/.test(text)) return "rejection";
  if (APPLIED.test(subject)) return "applied";
  const hasContext = APPLICATION_CONTEXT.test(text) || VENDORS.test(domain);
  if (ASSESSMENT.test(text) && hasContext) return "assessment";
  if (INTERVIEW_ANYWHERE.test(text) || (/\binterview\b/.test(text) && (INTERVIEW_SCHEDULING.test(text)))) {
    return "interview";
  }
  if (SCREEN.test(text)) return "screen";
  if (INTRO.test(text)) return "intro";
  if (APPLIED.test(text)) return "applied";
  return "other";
}

export function classifyEmail(email: InboxEmail): InboxEvent {
  const kind = kindOf(email);
  const lane: Lane = FOUNDER_WORDS.test(`${email.from} ${email.subject} ${email.body}`) ? "founder" : "jobs";
  return {
    emailId: email.id,
    company: companyFrom(email),
    role: kind === "other" ? null : roleFrom(email),
    kind,
    date: email.date,
    lane,
  };
}
