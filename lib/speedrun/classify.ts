import type { EventKind, InboxEmail, InboxEvent, Lane } from "./types";

const RULES: Array<[EventKind, RegExp]> = [
  ["offer", /pleased to offer|offer letter|extend (you )?an offer|offer of employment/],
  ["rejection", /unfortunately|not (be )?moving forward|will not be proceeding|decided to (move|go) forward with (other|another)/],
  ["assessment", /take-home|assessment|coding challenge|technical exercise/],
  ["interview", /interview|final round|onsite|partner meeting|pitch session/],
  ["screen", /phone screen|intro call|recruiter call|quick call|screening call/],
  ["intro", /introducing you|introduction:|warm intro|intro:/],
  ["applied", /thanks for applying|received your application|application (was )?received|application confirmation/],
];

const SENDER_SUFFIX =
  /\s+(careers|talent team|talent|hiring team|hiring|jobs|people team|people|founders|team)$/i;
const SENDER_PREFIX = /^(hiring at|careers at|founders at|team at|jobs at)\s+/i;
const FOUNDER_WORDS = /\baccelerator|\bventures?\b|\bfund\b|\bfounders?\b|\bpre-seed\b|\bdemo day\b|\bcohort\b|\bpitch\b|\bbatch\b/i;

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function companyFrom(from: string): string {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const display = match ? match[1].trim() : "";
  const address = match ? match[2] : from.trim();
  if (display) {
    const stripped = display.replace(SENDER_PREFIX, "").replace(SENDER_SUFFIX, "").trim();
    if (stripped) return stripped;
  }
  const domain = address.split("@")[1] ?? address;
  const label = domain.split(".")[0] ?? domain;
  return capitalize(label);
}

function roleFrom(email: InboxEmail): string | null {
  const line = email.body.match(/^Role:\s*(.+)$/m);
  if (line) return line[1].trim();
  const subject = email.subject.match(/\bfor (?:the )?(.+?) (?:at|role)\b/i);
  return subject ? subject[1].trim() : null;
}

export function classifyEmail(email: InboxEmail): InboxEvent {
  const text = `${email.subject}\n${email.body}`.toLowerCase();
  let kind: EventKind = "other";
  for (const [candidate, pattern] of RULES) {
    if (pattern.test(text)) {
      kind = candidate;
      break;
    }
  }
  if (kind === "other" && /no-?reply/i.test(email.from) && /application/.test(text)) kind = "noreply";
  const lane: Lane = FOUNDER_WORDS.test(`${email.from} ${email.subject} ${email.body}`) ? "founder" : "jobs";
  return {
    emailId: email.id,
    company: companyFrom(email.from),
    role: kind === "other" ? null : roleFrom(email),
    kind,
    date: email.date,
    lane,
  };
}
