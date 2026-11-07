import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const JOB_CONTEXT = /\b(application|candidate|position|role)\b/;
// Words that tie a message to the reader's own application, so a newsletter
// that merely mentions an interview or an assessment stays "other".
const APPLICATION_CONTEXT =
  /\b(your application|your candidacy|you applied|applied for|applying|the [\w ,&'-]{2,40} (role|position)|this (role|position))\b|^role:/m;

const OFFER = /pleased to offer|would like to offer you|offer letter|extend (you )?an offer|offer of employment/;
// The negation is tied to the offer phrase itself, so "not able to make the start date" stays an offer.
const NEGATED_OFFER =
  /\b(not|unable|can'?t|cannot|won'?t)\s+(be\s+)?(able\s+)?(in a position\s+)?(to\s+)?((extend|extending|make|making)\s+(you\s+)?an offer|offer\s+you\s+(the|a)\s+(position|role|job))/;
const REJECTION =
  /regret to inform|not (be )?moving forward|will not be proceeding|(decided not to|won'?t be|will not be|not) (be )?(move|moving|go|going|proceed|proceeding) forward|(pursue|pursuing|move forward with|moving forward with|proceed with|proceeding with) (other|another|different) (candidates?|applicants?)|decided to (move|go|pursue) .{0,30}(other|another)|(move|moving) forward with (a|another|other) (candidate|applicant)s?|(move|moving) in a different direction|(decided not to|unable to|not able to) (proceed|move forward|continue) with your (application|candidacy)|(role|position) has been (removed|filled|closed)/;
const ASSESSMENT = /take-home|coding challenge|online (coding )?test|coding test|online assessment|assessment|hackerrank|codesignal|technical exercise/;
// A direct ask about the reader's own interview needs no extra context; weaker mentions do.
const INTERVIEW_DIRECT =
  /interview invitation|invite you to .{0,30}interview|(reschedul\w*|schedul\w*|move|push|postpone|delay|confirm)\b.{0,25}\binterview\b/;
const INTERVIEW_WEAK = /\binterview\b|final round|onsite|partner meeting|pitch session/;
// Bare words like "role" or "your interview" are not enough on their own; they count only from a trusted sender.
const INTERVIEW_CONTEXT = /\b(application|candidate|candidacy|schedule a time|availability)\b|^role:|\bfor the [A-Z][\w ,&'-]{2,40} (role|position)\b/m;
const RESCHEDULE = /(reschedul\w*|push|move|postpone|delay)\b.{0,25}\binterview\b|another time|different time/;
const SCREEN = /phone screen|intro call|recruiter call|quick call|screening call/;
// Person to person only, so "excited to introduce you to our new flavors" stays marketing.
const INTRO_PHRASE = /\bintroduc(e|ing) you two\b|\byou two\b|introduction:|warm intro|intro:/i;
const INTRO_NAMED = /\bmeet [A-Z][a-z]+|\bconnect you with [A-Z][a-z]+|\bintroduc(e|ing) you to [A-Z][a-z]+/;
const APPLIED = /thanks for applying|thank you for applying|received your application|application (was |has been )?(received|submitted|sent)|application confirmation/;

const SENDER_SUFFIX = /\s+(careers|talent team|talent|hiring team|hiring|jobs|people team|people|founders|team)$/i;
const SENDER_PREFIX = /^(hiring at|careers at|founders at|team at|jobs at)\s+/i;
const GENERIC_LOCAL = /noreply|no-reply|careers|jobs|hiring|talent|apply|team|hello|info|news|support|people|notification/i;
const VENDORS = /(^|[^a-z])(greenhouse|lever|ashby|workday|myworkday|hackerrank|codesignal)/i;
const PLATFORMS = /(^|[^a-z])(greenhouse|lever|ashby|workday|myworkday|hackerrank|codesignal|linkedin|indeed|glassdoor)/i;
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

const HIRING_LOCAL = /careers|jobs|hiring|talent|apply|people/i;

/** A named human sender: "Priya Shah", "Priya K. Shah", or "Priya" at priya@. */
function senderIsPerson(display: string, local: string, domain: string): boolean {
  const nameLike = /^[A-Z][a-z]+(?: (?:[A-Z]\.|[A-Z][a-z]+)){1,3}$/.test(display);
  const single = /^[A-Z][a-z]+$/.test(display) && !PLATFORMS.test(domain);
  if (!(nameLike || single) || GENERIC_LOCAL.test(local)) return false;
  // The address must look like the name, so "The Commuter <letters@...>" is not a person.
  const words = display.toLowerCase().replace(/\./g, "").split(" ");
  const handle = local.toLowerCase();
  return handle.startsWith(words[0]) || handle.startsWith(words[0][0] + words[words.length - 1]);
}

function companyFromText(email: InboxEmail): string | null {
  const name = "[A-Z][\\w&'-]*(?:\\s+[A-Z][\\w&'-]*){0,2}";
  const patterns = [
    new RegExp(`\\b(${name}) (?:has |have )?invited you`, "g"),
    new RegExp(`\\binvited by (${name})`, "g"),
    new RegExp(`^(${name}) \\|`, "gm"),
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
  const personLike = senderIsPerson(display, local, domain) && stripped === display;
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
  const { display, local, domain } = parseSender(email.from);
  const sender = `${display} ${email.from}`;

  if (CALENDAR_SENDER.test(sender)) return "other";
  if (DIGEST_SENDER.test(sender) && !/your application|applying/.test(subject)) return "other";

  if (NEGATED_OFFER.test(text)) return "rejection";
  if (OFFER.test(text)) return "offer";
  if (REJECTION.test(text)) return "rejection";
  if (/\bunfortunately\b/.test(text) && JOB_CONTEXT.test(text) && !RESCHEDULE.test(text) && !/cannot respond|can't respond|unable to respond|high volume/.test(text)) return "rejection";
  const person = senderIsPerson(display, local, domain);
  const hasContext = APPLICATION_CONTEXT.test(text) || VENDORS.test(domain);
  if (ASSESSMENT.test(text) && hasContext && /next step|please complete|complete the/.test(text)) return "assessment";
  if (APPLIED.test(subject)) return "applied";
  if (ASSESSMENT.test(text) && hasContext) return "assessment";
  const trusted =
    (person && !GENERIC_MAIL.test(domain)) || PLATFORMS.test(domain) || HIRING_LOCAL.test(local) || HIRING_LOCAL.test(display);
  if (INTERVIEW_DIRECT.test(text) || (INTERVIEW_WEAK.test(text) && (INTERVIEW_CONTEXT.test(text) || trusted))) return "interview";
  if (SCREEN.test(text)) return "screen";
  if (INTRO_PHRASE.test(original) || (person && INTRO_NAMED.test(original))) return "intro";
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
