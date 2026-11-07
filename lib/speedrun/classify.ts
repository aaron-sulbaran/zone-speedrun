import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const JOB_CONTEXT = /\b(application|candidate|position|role)\b/;
// Words that tie a message to the reader's own application, so a newsletter
// that merely mentions an interview or an assessment stays "other".
const APPLICATION_CONTEXT =
  /\b(your application|your candidacy|you applied|applied for|applying|the [\w ,&'-]{2,40} (role|position)|this (role|position))\b|^role:/m;

const OFFER =
  /offer letter|extend (you )?an offer|offer of employment|\b(attach\w*|attached is|here is|here's|sending( you)?) your (formal |written |official )?offer\b|\bsign (your|the) offer\b|\byour offer (is attached|package)\b/;
// "We'd like to offer you an interview" offers a meeting, not a job.
const NOT_A_MEETING = "(?! (?:you )?(?:an? |the |your )?(?:[\\w-]+ ){0,2}?(?:interview|screen|call|chat|meeting|onsite|on-site|conversation|times?|slot)s?\\b)";
const OFFER_OPENING = new RegExp(`(?:pleased to offer|would like to offer you)${NOT_A_MEETING}`);
// Warmer openings count only from a hiring sender and only for a job, so "happy to offer you a free trial" stays other.
const WARM_OFFER_OPENING = new RegExp(
  `\\b(?:(?:'d|would) (?:like|love)|excited|thrilled|delighted|happy|glad) to offer you${NOT_A_MEETING} (?:a |an |the )?(?:[\\w,&'()-]+ ){0,6}?(?:role|position|job|internship|co-?op|place)\\b|\\b(?:make|making) you an offer\\b`,
);
// Read in the original case, so "an offer for the Software Engineer position" counts.
const OFFER_FOR_ROLE = /\boffer for the [A-Z][\w ,&'()-]{2,60} (role|position)\b/;
// "Your offer", the offer details and an e-signature count only from a hiring sender, with the terms beside them,
// so a "how does your offer compare" newsletter, a shop's "your offer of 20% off" and a realtor's "accepted your offer" stay other.
const YOUR_OFFER = /(?<!(negotiat\w*|evaluat\w*|compar\w*|weigh\w*|about|before you accept|sharing|accepted) )\byour offer\b(?! (compares?|stacks?|deadline)\b)|\boffer details\b/;
const OFFER_TERMS = /\b(start date|salary|equity|compensation|signed|signing|signature)\b/;
const DOCUSIGN_OFFER = /docusign[\s\S]*\boffer\b|\boffer\b[\s\S]*docusign/;
// Deals and newsletters: by the sender's name or mailbox, or by the words of a promotion.
const MARKETING_SENDER = /\b(news|newsletters?|weekly|daily|digest|bulletin|letters|offers|deals|promos?|marketing|rewards)\b/i;
const OFFER_MARKETING = /special offer|limited[- ]time|promo code|coupon|pre-?approved|\bapr\b|redeem/;
// The negation is tied to the offer phrase itself, so "not able to make the start date" stays an offer.
const NEGATED_OFFER =
  /\b(not|unable|can'?t|cannot|won'?t)\s+(be\s+)?(able\s+)?(in a position\s+)?(to\s+)?((extend|extending|make|making)\s+(you\s+)?an offer|(offer|offering)\s+you\s+(the|a)\s+(position|role|job))/;
// An offer whose recipient is not the reader is a no: "an offer to a candidate whose...", "offered the role to someone else",
// "offered to and accepted by another candidate", "another candidate has accepted our offer".
const OFFER_ELSEWHERE = [
  /\b(offer|offered|offering)\b[^.!?\n]{0,40}?\bto (another|a different|other|one of the other|a more \w+|an internal) (candidates?|applicants?|finalists?|person)\b/,
  /\b(?:(?:an|the|our|this|their) offers?(?: of employment)?|offers|offer(?:ed|ing)? (?:the|this|that|our) (?:role|position|job|spot|opening)|offered)\b(?:(?!\byou\b)[^.!?\n]){0,20}? to (?:and accepted by )?(?:someone|somebody|another\b|other\b|one of\b|(?:a|an|the)(?: [\w-]+){0,3} (?:candidate|applicant|finalist|person|individual)\b(?!s))/,
  /\b(?:another|other|a different|the other|one of the other) (?:[\w-]+ ){0,2}?(?:candidates?|applicants?|finalists?|person)\b (?:has |have )?(?:already )?(?:accepted|taken|signed)\b[^.!?\n]{0,20}?\boffer\b|\bsomeone else (?:has )?(?:accepted|taken)\b/,
];
// "If we don't hear back by Friday, we may extend the offer to another candidate" warns inside a real offer.
const HEDGE = /\b(if|unless|otherwise)\b|\b(may|might|could)( have to| need to| choose to| decide to)? (extend|make|offer|give|move)\b/;
const RESCINDED = /\b(rescind\w*|retract\w*) (your|the|our) offer\b/;
const REJECTIONS: RegExp[] = [
  /regret to inform|not (be )?moving forward|will not be proceeding/,
  /(decided not to|won'?t be|will not be|not) (be )?(move|moving|go|going|proceed|proceeding) forward/,
  /(decided not to|unable to|not able to) (proceed|move forward|continue)( with your (application|candidacy)| at this time)/,
  /(won'?t|will not|not) (be )?able to (proceed|move forward|go forward|continue)( further)?( with your (application|candidacy)| at this time)/,
  /(pursue|pursuing|move forward with|moving forward with|proceed with|proceeding with) (other|another|different) (candidates?|applicants?)/,
  /(chosen|chose|selected|hired|gone with|went with) (another|a different|other|a more \w+) (candidates?|applicants?)/,
  /decided to (move|go|pursue) .{0,30}(other|another)|(move|moving) forward with (a|another|other) (candidate|applicant)s?/,
  /(move|moving|going|decided to go|decided to head) in a different direction/,
  /decided not to (pursue|consider|continue with) your (application|candidacy)/,
  /(?<!if )\b(you|your application|your candidacy) (have not been|has not been|haven't been|hasn't been|were not|was not|weren't|wasn't) selected/,
  /(role|position) has been (removed|filled|closed)/,
  // Plural and unqualified: "decided to move forward with candidates whose qualifications more closely match".
  /decided to (move|go|proceed) forward with (other |different )?(candidates|applicants)\b/,
  /(move|moving|moved|go|going|proceed|proceeding) forward with (candidates|applicants) (whose|who|that) [^.!?\n]{0,60}\b(more closely|closer|better)\b/,
  /\b(can'?t|cannot|won'?t|will not|unable to|not able to|decided not to)( be able to)? (move|advance|progress|take) you (past|beyond|forward|further|to the next|on to)\b/,
];
// A subject that names the take-home itself, from a hiring sender, is the ask even when the body never says "application".
const TAKE_HOME_SUBJECT = /\b(take-?home|coding challenge)\b/;
const ASSESSMENT = /take-home|coding challenge|online (coding )?test|coding test|online assessment|assessment|hackerrank|codesignal|technical exercise/;
// A real ask, not a "you may get an assessment later": a deadline, a link or an imperative.
const ASSESSMENT_ASK =
  /\b(invite|invites|invited|inviting) you to (complete|take|start|attempt)\b|\b(we'd|we would) like you to (complete|take|start|finish|do)\b|\byou('ve| have) been invited\b|\bwithin (the next )?(\d+|a|one|two|three|four|five|six|seven|ten|fourteen) (business |calendar )?(hours?|days?|weeks?)\b|\blink below\b|\b(this|the following) link\b|https?:\/\/|\bclick\b|\bstart your\b|\bplease (complete|take|finish|start)\b|\bby (mon|tues|wednes|thurs|fri|satur|sun)day\b|\bby (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b|\bby \d{1,2}\/\d{1,2}\b|\bdeadline\b/;
// "If your profile is a match, we'll send you an assessment" describes a maybe, not an ask.
const CONDITIONAL = /\b(if|should you|once we|after we|when we)\b[^.!?]*\b(we'll|we will|you'll|you will|we may|you may|we might|you might|we'd|we would)\b/;
const SENTENCES = /(?<=[.!?])\s+|\n+/;
// A direct ask about the reader's own interview needs no extra context; weaker mentions do.
const INTERVIEW_DIRECT =
  /interview invitation|invite you to .{0,30}interview|(reschedul\w*|schedul\w*|move|push|postpone|delay|confirm)\b.{0,25}\binterview\b/;
const INTERVIEW_WEAK = /\binterview\b|final round|onsite|partner meeting|pitch session/;
// Bare words like "candidate" or "your interview" are not enough on their own; they count only from a trusted sender.
const INTERVIEW_CONTEXT = /\b(your application|your candidacy|you applied|applied for|schedule a time|availability)\b|^role:/m;
// Matched against the original case, so "for the Software Engineer role" counts and "for the role" does not.
const ROLE_NAMED = /\bfor the [A-Z][\w ,&'()-]{2,40} (role|position)\b/;
// Logistics for the reader's own onsite (a clock time, a date, a check-in detail) give it context with no role named.
const YOUR_INTERVIEW = /\byour (onsite|on-site|interviews?|final round|panel)\b|\bhosting you\b/;
const LOGISTICS =
  /\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.? \d{1,2}\b|\bon (mon|tues|wednes|thurs|fri|satur|sun)day\b|\bcheck in\b|\bfront desk\b|\bphoto id\b|\bparking\b|\bvisitor badge\b/;
const MARKETING = /\b(webinar|live class|online course|masterclass|bootcamp|register now|unsubscribe)\b|% off|percent off/;
const MOCK_INTERVIEW = /\bmock interviews?\b/g;
// Moving a meeting, not moving the reader: "move your interview to Friday" counts, "move you past the phone screen" does not.
const RESCHEDULE =
  /(reschedul\w*|postpone|delay)\b.{0,25}\b(interview|screen|call)\b|\b(push|move|shift|bump)( (back|up|out))? (our|your|the|this|my|tomorrow's|today's)\b(?:(?!\b(past|beyond|forward|ahead)\b).){0,25}\b(interview|screen|call)\b|another time|different time/;
const SCREEN = /phone screen|intro call|recruiter call|quick call|screening call/;
// "A 30-minute call", "a quick chat" or "a call about the role" is a screen from a hiring sender with a role in view.
const SCREEN_CALL =
  /\b(?:\d+[- ]?(?:minute|min)s?|quick|short|brief|introductory|initial)\s+(?:phone |video |zoom )?(?:call|chat|conversation)\b|\b(?:call|chat|conversation) about (?:the|this|our|your) (?:[\w,&'-]+ ){0,4}?(?:role|position|opportunity|opening)\b/;
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
const HIRING_TOOLS =
  "greenhouse|lever|ashby|workday|myworkday|workable|smartrecruiters|icims|jobvite|hackerrank|codesignal|codility|coderpad|karat|goodtime|modernloop";
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
// "Lena from Brindle Labs", "Lena at Brindle Labs": a person's name, then the company.
const VIA_DISPLAY = /^[A-Z][a-z]+(?: [A-Z][a-z]+)? (?:from|at|@) ([A-Z0-9].*)$/;
// Words after the company's own name that name a mailbox, not a longer company: "Tidewell Talent Acquisition".
const MAILBOX_WORDS = new Set(
  "careers career jobs job talent acquisition hiring team people culture ops operations hr human resources university campus programs program early scheduling interviews interview coordination staffing recruiter recruiters notifications and of".split(" "),
);
const SIGN_OFF = /^(best|thanks|thank you|many thanks|regards|kind regards|best regards|warm regards|cheers|sincerely|warmly|all the best|talk soon|see you soon|take care)\b.{0,20}$/i;

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

/** The name part of a domain: tidewell for tidewell.example, qorvanthe for careers.qorvanthe.co.uk. */
function domainLabel(domain: string): string {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return parts[0] ?? "";
  const country = parts.length >= 3 && parts[parts.length - 1].length === 2 && /^(co|com|org|ac|gov|net)$/.test(parts[parts.length - 2]);
  return parts[parts.length - (country ? 3 : 2)];
}

/**
 * "Harrow & Vale University Programs" at harrowvale.example is "Harrow & Vale": the leading words that spell the label,
 * but only when every word after them names a mailbox (or is the mailbox's own address), so
 * "Halden Robotics Careers" at halden.example stays "Halden Robotics".
 */
function mailboxTrimmed(display: string, label: string, local: string): string | null {
  const words = display.split(/\s+/);
  let spelled = "";
  for (let index = 0; index < words.length; index += 1) {
    spelled += squash(words[index]);
    if (spelled === label) {
      const rest = words.slice(index + 1).map(squash).filter(Boolean);
      const handle = squash(local);
      // One trailing "-ing" word from a hiring address ("Quillpoint Staffing" at scheduling@) is a mailbox too.
      const hiringAddress = MAILBOX_WORDS.has(handle) || HIRING_LOCAL.test(local);
      const mailbox =
        rest.every((word) => MAILBOX_WORDS.has(word) || word === handle) || (rest.length === 1 && rest[0].endsWith("ing") && hiringAddress);
      return mailbox ? words.slice(0, index + 1).join(" ") : null;
    }
    if (!label.startsWith(spelled)) return null;
  }
  return null;
}

/** The body above the sign-off, so a signature that restates the sender's name does not count as the text naming them. */
function aboveSignOff(body: string, display: string): string {
  const lines = body.split("\n");
  for (let index = lines.length - 1; index > 0; index -= 1) {
    const line = lines[index].trim();
    if (SIGN_OFF.test(line) || line === display) return lines.slice(0, index).join("\n");
  }
  return body;
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
  // A standalone "&" joins words, so "Harbor & Pine" stays whole.
  const name = "[A-Z][\\w&'-]*(?:\\s+(?:&\\s+)?[A-Z][\\w&'-]*){0,2}";
  const patterns = [
    new RegExp(`\\b(${name}) (?:has |have )?invited you`, "g"),
    new RegExp(`\\binvited by (${name})`, "g"),
    new RegExp(`^(${name}) \\|`, "gm"),
    new RegExp(`\\byour (${name}) (?:assessment|test|application|interview)`, "g"),
    new RegExp(`\\bon behalf of (${name})`, "g"),
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
  const named = display.replace(SENDER_PREFIX, "").trim().replace(VIA_DISPLAY, "$1");
  const stripped = named.replace(SENDER_SUFFIX, "").trim();
  const companyDomain = Boolean(domain) && !PLATFORMS.test(domain) && !GENERIC_MAIL.test(domain);
  const personLike = senderIsPerson(display, local, domain) && stripped === display;
  if (named && !personLike && companyDomain) {
    const trimmed = mailboxTrimmed(named, domainLabel(domain), local);
    if (trimmed) return trimmed;
  }
  // A person writing through a hiring tool's no-reply ("Priya Shah <no-reply@...greenhouse...>") names the company in the text.
  const text = `${email.subject}\n${aboveSignOff(email.body, display)}`.toLowerCase();
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

/** True when a sentence holds the thing `find` locates with no condition ("if ..., we'll", "once we ...") before it. */
function saidOutright(text: string, find: (sentence: string) => number): boolean {
  return text.split(SENTENCES).some((sentence) => {
    const at = find(sentence);
    if (at < 0) return false;
    const conditional = sentence.search(CONDITIONAL);
    return conditional < 0 || conditional > at;
  });
}

const asksForAssessment = (text: string) => saidOutright(text, (sentence) => (ASSESSMENT_ASK.test(sentence) ? sentence.search(ASSESSMENT) : -1));
const asksForCall = (text: string) => saidOutright(text, (sentence) => sentence.search(SCREEN_CALL));

function offerWentElsewhere(text: string): boolean {
  return RESCINDED.test(text) || text.split(SENTENCES).some((sentence) => OFFER_ELSEWHERE.some((pattern) => pattern.test(sentence)) && !HEDGE.test(sentence));
}

function kindOf(email: InboxEmail): EventKind {
  const original = `${email.subject}\n${email.body}`.replace(/[‘’]/g, "'");
  const text = original.toLowerCase();
  const subject = email.subject.replace(/[‘’]/g, "'").toLowerCase();
  const { display, local, domain } = parseSender(email.from);
  const sender = `${display} ${email.from}`;

  if (CALENDAR_SENDER.test(sender) || CALENDAR_SUBJECT.test(subject) || CALENDAR_BODY.test(text)) return "other";
  if (DIGEST_SENDER.test(sender) && !/your application|applying/.test(subject)) return "other";

  if (NEGATED_OFFER.test(text) || offerWentElsewhere(text)) return "rejection";
  const person = senderIsPerson(display, local, domain);
  const trusted =
    (person && !GENERIC_MAIL.test(domain)) || PLATFORMS.test(domain) || HIRING_LOCAL.test(local) || HIRING_LOCAL.test(display);
  // A person at a company, a hiring tool or a hiring mailbox; never a newsletter or a shop.
  const hiringSender = trusted && !MARKETING_SENDER.test(`${display} ${local}`);
  const hiringOffer =
    hiringSender &&
    !MARKETING.test(text) &&
    !OFFER_MARKETING.test(text) &&
    (WARM_OFFER_OPENING.test(text) || (YOUR_OFFER.test(text) && OFFER_TERMS.test(text)) || DOCUSIGN_OFFER.test(text));
  if (OFFER.test(text) || OFFER_OPENING.test(text) || OFFER_FOR_ROLE.test(original) || hiringOffer) return "offer";
  if (REJECTIONS.some((pattern) => pattern.test(text))) return "rejection";
  if (/\bunfortunately\b/.test(text) && JOB_CONTEXT.test(text) && !RESCHEDULE.test(text) && !/cannot respond|can't respond|unable to respond|high volume/.test(text)) return "rejection";
  const hasContext = APPLICATION_CONTEXT.test(text) || VENDORS.test(domain);
  if (ASSESSMENT.test(text) && hasContext && asksForAssessment(text)) return "assessment";
  if (APPLIED.test(subject)) return "applied";
  if (ASSESSMENT.test(text) && hasContext) return "assessment";
  if (hiringSender && TAKE_HOME_SUBJECT.test(subject) && !MARKETING.test(text)) return "assessment";
  const interviewText = text.replace(MOCK_INTERVIEW, "");
  const logistics = YOUR_INTERVIEW.test(interviewText) && LOGISTICS.test(interviewText) && !MARKETING.test(interviewText);
  const interviewContext = INTERVIEW_CONTEXT.test(interviewText) || ROLE_NAMED.test(original) || trusted || logistics;
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
  if (hiringSender && JOB_CONTEXT.test(text) && asksForCall(text)) return "screen";
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
