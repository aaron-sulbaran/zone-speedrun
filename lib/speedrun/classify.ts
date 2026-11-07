import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const JOB_CONTEXT = /\b(application|candidate|position|role)\b/;
// Words that tie a message to the reader's own application, so a newsletter
// that merely mentions an interview or an assessment stays "other".
const APPLICATION_CONTEXT =
  /\b(your application|your candidacy|you applied|applied for|applying|the [\w ,&'-]{2,40} (role|position)|this (role|position))\b|^role:/m;

const OFFER = /pleased to offer|would like to offer you|offer letter|extend (you )?an offer|offer of employment/;
// The negation is tied to the offer phrase itself, so "not able to make the start date" stays an offer.
const NEGATED_OFFER =
  /\b(not|unable|can'?t|cannot|won'?t)\s+(be\s+)?(able\s+)?(in a position\s+)?(to\s+)?((extend|extending|make|making)\s+(you\s+)?an offer|(offer|offering)\s+you\s+(the|a)\s+(position|role|job))/;
const REJECTIONS: RegExp[] = [
  /regret to inform|not (be )?moving forward|will not be proceeding/,
  /(decided not to|won'?t be|will not be|not) (be )?(move|moving|go|going|proceed|proceeding) forward/,
  /(decided not to|unable to|not able to) (proceed|move forward|continue) with your (application|candidacy)/,
  /(won'?t|will not|not) be able to (proceed|move forward|go forward|continue)( further)?( with your (application|candidacy)| at this time)/,
  /(pursue|pursuing|move forward with|moving forward with|proceed with|proceeding with) (other|another|different) (candidates?|applicants?)/,
  /(chosen|chose|selected|hired|gone with|went with) (another|a different|other|a more \w+) (candidates?|applicants?)/,
  /decided to (move|go|pursue) .{0,30}(other|another)|(move|moving) forward with (a|another|other) (candidate|applicant)s?/,
  /(move|moving|going|decided to go|decided to head) in a different direction/,
  /decided not to (pursue|consider|continue with) your (application|candidacy)/,
  /(?<!if )\b(you|your application|your candidacy) (have not been|has not been|haven't been|hasn't been|were not|was not|weren't|wasn't) selected/,
  /(role|position) has been (removed|filled|closed)/,
];
const ASSESSMENT = /take-home|coding challenge|online (coding )?test|coding test|online assessment|assessment|hackerrank|codesignal|technical exercise/;
// A real ask, not a "you may get an assessment later": a deadline, a link or an imperative.
const ASSESSMENT_ASK =
  /\bwithin (the next )?(\d+|a|one|two|three|four|five|six|seven|ten|fourteen) (business |calendar )?(hours?|days?|weeks?)\b|\blink below\b|\b(this|the following) link\b|https?:\/\/|\bclick\b|\bstart your\b|\bplease (complete|take|finish|start)\b|\bby (mon|tues|wednes|thurs|fri|satur|sun)day\b|\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\bby \d{1,2}\/\d{1,2}\b|\bdeadline\b/;
// A direct ask about the reader's own interview needs no extra context; weaker mentions do.
const INTERVIEW_DIRECT =
  /interview invitation|invite you to .{0,30}interview|(reschedul\w*|schedul\w*|move|push|postpone|delay|confirm)\b.{0,25}\binterview\b/;
const INTERVIEW_WEAK = /\binterview\b|final round|onsite|partner meeting|pitch session/;
// Bare words like "candidate" or "your interview" are not enough on their own; they count only from a trusted sender.
const INTERVIEW_CONTEXT = /\b(your application|your candidacy|you applied|applied for|schedule a time|availability)\b|^role:/m;
// Matched against the original case, so "for the Software Engineer role" counts and "for the role" does not.
const ROLE_NAMED = /\bfor the [A-Z][\w ,&'()-]{2,40} (role|position)\b/;
const MOCK_INTERVIEW = /\bmock interviews?\b/g;
const RESCHEDULE = /(reschedul\w*|push|move|postpone|delay)\b.{0,25}\b(interview|phone screen|screen|call)\b|another time|different time/;
const SCREEN = /phone screen|intro call|recruiter call|quick call|screening call/;
// Person to person only, so "excited to introduce you to our new flavors" stays marketing.
const INTRO_PHRASE = /\bintroduc(e|ing) you two\b|\byou two\b|introduction:|warm intro|intro:/i;
const INTRO_NAMED = /\bmeet [A-Z][a-z]+|\bconnect you with [A-Z][a-z]+|\bintroduc(e|ing) you to [A-Z][a-z]+/;
const INTRO_FIRST_PERSON =
  /\bI('d|'m| would| want| wanted| am)?( (love|like|happy|glad|excited))?( to)? (introduce you to|connect you with) [A-Z][a-z]+/;
const SUBJECT_PAIR = /\S\s<>\s\S/;
const APPLIED = /thanks for applying|thank you for applying|received your application|application (was |has been )?(received|submitted|sent)|application confirmation/;

const SENDER_SUFFIX = /\s+(careers|talent team|talent|hiring team|hiring|jobs|people team|people|founders|team)$/i;
const SENDER_PREFIX = /^(hiring at|careers at|founders at|team at|jobs at)\s+/i;
const GENERIC_LOCAL = /noreply|no-reply|careers|jobs|hiring|talent|apply|team|hello|info|news|support|people|notification/i;
const HIRING_LOCAL = /careers|jobs|hiring|talent|apply|people/i;
const HIRING_TOOLS = "greenhouse|lever|ashby|workday|myworkday|workable|smartrecruiters|icims|jobvite|hackerrank|codesignal|goodtime|modernloop";
const VENDORS = new RegExp(`(^|[^a-z])(${HIRING_TOOLS})`, "i");
const PLATFORMS = new RegExp(`(^|[^a-z])(${HIRING_TOOLS}|linkedin|indeed|glassdoor)`, "i");
const GENERIC_MAIL = /^(gmail|outlook|yahoo|icloud|hotmail|proton|protonmail)\./i;
const DIGEST_SENDER = /linkedin|indeed|glassdoor|jobalert|digest|newsletter/i;
// Calendar invitations from any calendar tool, by sender or by the invitation's own shape.
const CALENDAR_SENDER = /(^|[^a-z])calendar([^a-z]|$)/i;
const CALENDAR_SUBJECT = /^(updated |canceled |cancelled )?invitation: .+ @ |^(accepted|declined|tentatively accepted|canceled event|cancelled event): /i;
const CALENDAR_BODY = /invited to the following event|\binvite\.ics\b/i;
const FOUNDER_WORDS = /\baccelerator|\bventures?\b|\bfund\b|\bfounders?\b|\bpre-seed\b|\bdemo day\b|\bcohort\b|\bpitch\b|\bbatch\b/i;
const NAME_LIKE = /^[A-Z][a-z]+(?: (?:[A-Z]\.|[A-Z][a-z]+)){1,3}$/;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "");

function parseSender(from: string): { display: string; local: string; domain: string } {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const display = match ? match[1].trim() : "";
  const address = match ? match[2] : from.trim();
  const [local = "", domain = ""] = address.split("@");
  return { display, local, domain };
}

/** The name part of a domain: acme for acme.com, careers.acme.co.uk and acme.example. */
function domainLabel(domain: string): string {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return parts[0] ?? "";
  const country = parts.length >= 3 && parts[parts.length - 1].length === 2 && /^(co|com|org|ac|gov|net)$/.test(parts[parts.length - 2]);
  return parts[parts.length - (country ? 3 : 2)];
}

/** "Harrow & Vale University Programs" at harrowvale.com is "Harrow & Vale": the leading words that spell the label. */
function wordsSpelling(display: string, label: string): string | null {
  const words = display.split(/\s+/);
  let spelled = "";
  for (let index = 0; index < words.length; index += 1) {
    spelled += squash(words[index]);
    if (spelled === label) return words.slice(0, index + 1).join(" ");
    if (!label.startsWith(spelled)) return null;
  }
  return null;
}

/** A named human sender: "Priya Shah", "Priya K. Shah", or "Priya" at priya@. */
function senderIsPerson(display: string, local: string, domain: string): boolean {
  const single = /^[A-Z][a-z]+$/.test(display) && !PLATFORMS.test(domain);
  if (!(NAME_LIKE.test(display) || single) || GENERIC_LOCAL.test(local)) return false;
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
  const named = display.replace(SENDER_PREFIX, "").trim();
  const stripped = named.replace(SENDER_SUFFIX, "").trim();
  const companyDomain = Boolean(domain) && !PLATFORMS.test(domain) && !GENERIC_MAIL.test(domain);
  const personLike = senderIsPerson(display, local, domain) && stripped === display;
  if (named && !personLike && companyDomain) {
    const spelled = wordsSpelling(named, domainLabel(domain));
    if (spelled) return spelled;
  }
  // A person writing through a hiring tool's no-reply ("Priya Shah <no-reply@...greenhouse...>") names the company in the text.
  const text = `${email.subject}\n${email.body}`.toLowerCase();
  if (PLATFORMS.test(domain) && NAME_LIKE.test(display) && stripped === display && !text.includes(display.toLowerCase())) {
    const fromText = companyFromText(email);
    if (fromText) return fromText;
  }
  if (stripped && !personLike && !PLATFORMS.test(display)) return stripped;
  if (companyDomain) return capitalize(domainLabel(domain));
  return companyFromText(email) ?? (stripped || capitalize(domain.split(".")[0] || "Unknown"));
}

function roleFrom(email: InboxEmail): string | null {
  const line = email.body.match(/^Role:\s*(.+)$/m);
  if (line) return line[1].trim();
  const subject = email.subject.match(/\b(?:applying|application) for (?:the )?(.+?)(?: role| position)? at\b/i);
  return subject ? subject[1].trim() : null;
}

function asksForAssessment(text: string): boolean {
  return text.split(/(?<=[.!?])\s+|\n+/).some((sentence) => ASSESSMENT.test(sentence) && ASSESSMENT_ASK.test(sentence));
}

function kindOf(email: InboxEmail): EventKind {
  const original = `${email.subject}\n${email.body}`.replace(/[‘’]/g, "'");
  const text = original.toLowerCase();
  const subject = email.subject.replace(/[‘’]/g, "'").toLowerCase();
  const { display, local, domain } = parseSender(email.from);
  const sender = `${display} ${email.from}`;

  if (CALENDAR_SENDER.test(sender) || CALENDAR_SUBJECT.test(subject) || CALENDAR_BODY.test(text)) return "other";
  if (DIGEST_SENDER.test(sender) && !/your application|applying/.test(subject)) return "other";

  if (NEGATED_OFFER.test(text)) return "rejection";
  if (OFFER.test(text)) return "offer";
  if (REJECTIONS.some((pattern) => pattern.test(text))) return "rejection";
  if (/\bunfortunately\b/.test(text) && JOB_CONTEXT.test(text) && !RESCHEDULE.test(text) && !/cannot respond|can't respond|unable to respond|high volume/.test(text)) return "rejection";
  const person = senderIsPerson(display, local, domain);
  const hasContext = APPLICATION_CONTEXT.test(text) || VENDORS.test(domain);
  if (ASSESSMENT.test(text) && hasContext && asksForAssessment(text)) return "assessment";
  if (APPLIED.test(subject)) return "applied";
  if (ASSESSMENT.test(text) && hasContext) return "assessment";
  const trusted =
    (person && !GENERIC_MAIL.test(domain)) || PLATFORMS.test(domain) || HIRING_LOCAL.test(local) || HIRING_LOCAL.test(display);
  const interviewText = text.replace(MOCK_INTERVIEW, "");
  const interviewContext = INTERVIEW_CONTEXT.test(interviewText) || ROLE_NAMED.test(original) || trusted;
  if (INTERVIEW_DIRECT.test(interviewText) || (INTERVIEW_WEAK.test(interviewText) && interviewContext)) return "interview";
  if (SCREEN.test(text)) return "screen";
  // A named friend writing from webmail counts as a person for intros, whatever the handle.
  const writer = person || (NAME_LIKE.test(display) && GENERIC_MAIL.test(domain));
  const namedWriter = NAME_LIKE.test(display) && !GENERIC_LOCAL.test(local);
  if (
    INTRO_PHRASE.test(original) ||
    (SUBJECT_PAIR.test(email.subject) && !GENERIC_LOCAL.test(local)) ||
    (writer && INTRO_NAMED.test(original)) ||
    (namedWriter && INTRO_FIRST_PERSON.test(original))
  )
    return "intro";
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
