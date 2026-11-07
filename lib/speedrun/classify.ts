import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const JOB_CONTEXT = /\b(application|candidate|position|role)\b/;
// Words that tie a message to the reader's own application, so a newsletter
// that merely mentions an interview or an assessment stays "other".
const APPLICATION_CONTEXT =
  /\b(your application|your candidacy|you applied|applied for|applying|the [\w ,&'-]{2,40} (role|position)|this (role|position))\b|^role:/m;

const OFFER = /pleased to offer|would like to offer you|offer letter|extend (you )?an offer|offer of employment/;
// The negation is tied to the offer phrase itself, so "not able to make the start date" stays an offer.
const NEGATED_OFFER = /\b(not|unable|can'?t|cannot|won'?t)\s+(be\s+)?(able\s+to\s+)?(extend|extending|make|making)\s+(you\s+)?an offer/;
const REJECTION =
  /regret to inform|not (be )?moving forward|will not be proceeding|(decided not to|won'?t be|will not be|not) (be )?(move|moving|go|going|proceed|proceeding) forward|(pursue|pursuing|move forward with|moving forward with|proceed with|proceeding with) (other|another|different) (candidates?|applicants?)|decided to (move|go|pursue) .{0,30}(other|another)/;
const ASSESSMENT = /take-home|coding challenge|online coding test|online assessment|assessment|hackerrank|codesignal|technical exercise/;
// A direct ask about the reader's own interview needs no extra context; weaker mentions do.
const INTERVIEW_DIRECT =
  /interview invitation|invite you to .{0,30}interview|(reschedule|move|push|postpone|delay|schedule|confirm) .{0,25}interview|your interview/;
const INTERVIEW_WEAK = /\binterview\b|final round|onsite|partner meeting|pitch session/;
const INTERVIEW_CONTEXT = /\b(role|position|application|candidate|candidacy|your interview|schedule a time|availability)\b/;
const RESCHEDULE = /reschedul|push|move|another time|different time|postpone|delay/;
const SCREEN = /phone screen|intro call|recruiter call|quick call|screening call/;
// Person to person only, so "excited to introduce you to our new flavors" stays marketing.
const INTRO_PHRASE = /\bintroduc(e|ing) you two\b|\byou two\b|connect you with|introduction:|warm intro|intro:/i;
const INTRO_NAMED = /\bmeet [A-Z][a-z]+|\bintroduc(e|ing) you to [A-Z][a-z]+/;
const APPLIED = /thanks for applying|thank you for applying|received your application|application (was |has been )?(received|submitted|sent)|application confirmation/;

const SENDER_SUFFIX = /\s+(careers|talent team|talent|hiring team|hiring|jobs|people team|people|founders|team)$/i;
const SENDER_PREFIX = /^(hiring at|careers at|founders at|team at|jobs at)\s+/i;
const GENERIC_LOCAL = /noreply|no-reply|careers|jobs|hiring|talent|apply|team|hello|info|news|support|people|notification/i;
const VENDORS = /(^|[^a-z])(greenhouse|lever|ashby|workday|hackerrank|codesignal)/i;
const PLATFORMS = /(^|[^a-z])(greenhouse|lever|ashby|workday|hackerrank|codesignal|linkedin|indeed|glassdoor)/i;
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
  const name = "[A-Z][\\w&'-]*(?:\\s+[A-Z][\\w&'-]*){0,2}";
  const patterns = [
    new RegExp(`\\b(${name}) (?:has |have )?invited you`, "g"),
    new RegExp(`\\byour (${name}) (?:assessment|test|application|interview)`, "g"),
    new RegExp(`\\b(?:at|to|with|from)\\s+(${name})`, "g"),
  ];
  for (const text of [email.subject, email.body]) {
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        if (!PLATFORMS.test(match[1]) && !/^(Please|Thanks|Thank|Hi|Hello|Dear)$/.test(match[1])) return match[1];
      }
    }
  }
  return null;
}

function companyFrom(email: InboxEmail): string {
  const { display, local, domain } = parseSender(email.from);
  const stripped = display.replace(SENDER_PREFIX, "").replace(SENDER_SUFFIX, "").trim();
  const nameLike = /^[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}$/.test(display);
  const singleNamePerson = /^[A-Z][a-z]+$/.test(display) && local.toLowerCase().startsWith(display.toLowerCase());
  const personLike = (nameLike || singleNamePerson) && stripped === display && !GENERIC_LOCAL.test(local);
  if (stripped && !personLike && !PLATFORMS.test(display)) return stripped;
  if (domain && !PLATFORMS.test(domain) && !GENERIC_MAIL.test(domain)) {
    const parts = domain.split(".");
    const country = parts.length >= 3 && parts[parts.length - 1].length === 2 && /^(co|com|org|ac|gov|net)$/.test(parts[parts.length - 2]);
    return capitalize(parts.length >= 2 ? parts[parts.length - (country ? 3 : 2)] : parts[0]);
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
  const original = `${email.subject}\n${email.body}`.replace(/[\u2018\u2019]/g, "'");
  const text = original.toLowerCase();
  const subject = email.subject.replace(/[\u2018\u2019]/g, "'").toLowerCase();
  const { display, domain } = parseSender(email.from);
  const sender = `${display} ${email.from}`;

  if (CALENDAR_SENDER.test(sender)) return "other";
  if (DIGEST_SENDER.test(sender) && !/your application|applying/.test(subject)) return "other";

  if (NEGATED_OFFER.test(text)) return "rejection";
  if (OFFER.test(text)) return "offer";
  if (REJECTION.test(text)) return "rejection";
  if (/\bunfortunately\b/.test(text) && JOB_CONTEXT.test(text) && !(/interview/.test(text) && RESCHEDULE.test(text))) return "rejection";
  if (APPLIED.test(subject)) return "applied";
  const hasContext = APPLICATION_CONTEXT.test(text) || VENDORS.test(domain);
  if (ASSESSMENT.test(text) && hasContext) return "assessment";
  if (INTERVIEW_DIRECT.test(text) || (INTERVIEW_WEAK.test(text) && INTERVIEW_CONTEXT.test(text))) return "interview";
  if (SCREEN.test(text)) return "screen";
  if (INTRO_PHRASE.test(original) || INTRO_NAMED.test(original)) return "intro";
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
