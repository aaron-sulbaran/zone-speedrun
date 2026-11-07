import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { buildPipeline } from "./pipeline";
import type { EventKind, InboxEmail } from "./types";

// A regression battery for the inbox reader: one realistic, made-up email per
// row. Columns: label, expected kind, expected company ("" when it does not
// matter), from, subject, body. Add a row for every real-world miss.
const hr = "Acme Careers <careers@acme.com>";
const CASES: Array<[string, EventKind, string, string, string, string]> = [
  ["battery applied:greenhouse", "applied", "Acme", "Acme <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Acme", "Hi Sam,\nThank you for applying to Acme! Your application has been received and we will review it shortly.\n\nBest,\nThe Acme Team"],
  ["battery applied:lever", "applied", "Acme", "Acme <no-reply@hire.lever.co>", "Thank you for your application to Acme", "Hi Sam, thanks for your interest in the Software Engineer role at Acme. We've received your application and will be in touch."],
  ["battery applied:workday", "applied", "Acme", "Acme Careers <acme@myworkday.com>", "Application confirmation", "Thank you for applying for Software Engineer, New Grad. We have successfully received your submission."],
  ["battery assessment:codesignal", "assessment", "Acme", "CodeSignal <noreply@codesignal.com>", "Acme invited you to a General Coding Assessment", "Acme has invited you to take a coding assessment on CodeSignal. Please complete it within 7 days."],
  ["battery assessment:hackerrank", "assessment", "Acme", "HackerRank <support@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test. Test duration: 90 minutes."],
  ["battery interview:sched", "interview", "Acme", "Priya Shah <priya.shah@acme.com>", "Next steps with Acme", "Hi Sam, the team enjoyed your phone screen and would like to move you to the onsite. Please use this link to pick a time for your interviews."],
  ["battery interview:ashby", "interview", "Acme", "Acme Hiring Team <no-reply@ashbyhq.com>", "Schedule your interview with Acme", "Hi Sam, please select a time for your technical interview with our engineering team."],
  ["battery interview:reschedule", "interview", "Acme", "Acme Talent <talent@acme.com>", "Rescheduling your interview", "Hi Sam, unfortunately our interviewer is out sick tomorrow. Could we move your interview to Thursday?"],
  ["battery offer:plain", "offer", "Acme", "Acme Hiring <hiring@acme.com>", "Your offer from Acme", "Hi Sam, we're thrilled to extend you an offer to join Acme as a Product Engineer. Details attached."],
  ["battery offer:verbal", "offer", "Acme", "Priya Shah <priya.shah@acme.com>", "Great news", "Hi Sam, congratulations! We would like to offer you the Product Engineer role. Let's find a time to go over the details."],
  ["battery rejection:regret", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Your application to Acme", "Hi Sam, thank you for applying. We regret to inform you that we have decided to pursue other candidates for this role."],
  ["battery rejection:unable-extend", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Update on your Acme application", "Hi Sam, thank you for interviewing with us. At this time we are not able to extend an offer, but we enjoyed meeting you."],
  ["battery rejection:filled", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Software Engineer position", "Thank you for your interest. The position has been filled and we will not be proceeding with your application."],
  ["battery rejection:other-cands", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Regarding your application", "After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our needs."],
  ["battery intro:introduce", "intro", "", "Jordan Lee <jordan@gmail.com>", "Sam <> Priya (Acme)", "Hi both, I wanted to introduce you two. Priya is building Acme and is hiring a founding engineer. I'll let you take it from here."],
  ["battery intro:intro-colon", "intro", "", "Jordan Lee <jordan@gmail.com>", "Intro: Sam / Priya", "Priya, meet Sam. Sam, meet Priya."],
  ["battery other:calendar-interview", "other", "", "Google Calendar <calendar-notification@google.com>", "Invitation: Interview with Acme @ Tue Nov 10, 2026 2pm - 3pm (CST) (sam@example.com)", "You have been invited to the following event. Join with Google Meet."],
  ["battery other:calendar-generic", "other", "", "Google Calendar <calendar-notification@google.com>", "Invitation: Dentist @ Wed Nov 11, 2026 9am", "You have been invited to the following event."],
  ["battery other:newsletter-unfortunately", "other", "", "Weeknight Table <news@weeknighttable.com>", "Holiday box update", "Unfortunately our holiday box sold out. Here are three dinners you can make with pantry staples."],
  ["battery other:newsletter-interview", "other", "", "The Commuter <letters@thecommuter.news>", "Our interview with a transit planner", "This week we sat down for an interview about why buses bunch."],
  ["battery other:newsletter-assessment", "other", "", "Craft Notes <craft@notes.example>", "How to run a product assessment", "A framework for honest product reviews."],
  ["battery other:jobboard-digest", "other", "", "LinkedIn <jobs-noreply@linkedin.com>", "30 new jobs for Software Engineer", "Apply now: Software Engineer at Acme. Your application could be next. Easy Apply."],
  ["battery X offer+not-able-to-make", "offer", "Acme", "Acme Hiring <hiring@acme.com>", "Your offer from Acme", "We are pleased to offer you the Product Engineer position. If you are not able to make the January 5 start date, let us know."],
  ["battery X offer+cannot-offer-reloc", "offer", "Acme", "Acme Hiring <hiring@acme.com>", "Offer letter", "We are pleased to offer you the role. We cannot offer relocation support, but the base salary is attached."],
  ["battery X won't be extending", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Your Acme application", "Thank you for interviewing. We won't be extending an offer at this time."],
  ["battery X curly can't extend", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Your Acme application", "Thank you for interviewing. We can’t extend an offer at this time."],
  ["battery X decided not to move fwd", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Thank you for applying to Acme", "After careful review, we have decided not to move forward with your candidacy."],
  ["battery X won't be moving fwd", "rejection", "Acme", "Acme Careers <careers@acme.com>", "Your application to Acme", "We won't be moving forward with your application."],
  ["battery X marketing introduce you", "other", "", "Frost Boxes <hi@frostboxes.com>", "Meet the winter box", "We're excited to introduce you to our new winter flavors."],
  ["battery X newsletter final round", "other", "", "Sports Daily <daily@sportsdaily.com>", "Final round tonight", "The final round tees off at 2pm."],
  ["battery X newsletter onsite", "other", "", "Design Weekly <hi@designweekly.com>", "Join our onsite workshop", "Our onsite workshop is in Austin this month."],
  ["battery X interview push role", "interview", "Acme", "Acme Talent <talent@acme.com>", "Interview time", "Unfortunately our interviewer is out sick. Can we push the interview for the role to Friday?"],
  ["battery X single-name person", "interview", "Acme", "Priya <priya@acme.com>", "Final round", "Looking forward to your final round."],
  ["battery X person mid initial", "interview", "Acme", "Priya K. Shah <priya@acme.com>", "Final round", "Looking forward to your final round."],
  ["battery X linkedin easy apply", "applied", "Acme", "LinkedIn <jobs-noreply@linkedin.com>", "Sam, your application was sent to Acme", "Your application was sent to Acme. Software Engineer."],
  ["battery X ccTLD", "interview", "Acme", "Acme Talent <talent@acme.co.uk>", "Interview invitation", "We would like to invite you to an interview for the role."],
  ["battery X ccTLD person", "interview", "Acme", "Priya Shah <priya@acme.co.uk>", "Final round", "Looking forward to your final round."],
  ["battery X confirm+assessment", "assessment", "Acme", "Acme Careers <careers@acme.com>", "Thank you for applying to Acme", "Next step: please complete the HackerRank assessment within 5 days."],
  ["round3 F1 start date caveat", "offer", "Acme", hr, "Your offer from Acme", "We are pleased to offer you the Product Engineer position. If you are not able to make the January 5 start date, let us know."],
  ["round3 F1 no relocation", "offer", "Acme", hr, "Offer letter", "We are pleased to offer you the role. We cannot offer relocation support."],
  ["round3 F1 travel plans", "offer", "Acme", hr, "Offer letter", "We are pleased to offer you the role. Please do not make any travel plans until you sign."],
  ["round3 F1 no signing bonus", "offer", "Acme", hr, "Offer letter", "We would like to offer you the position. We are not offering a signing bonus."],
  ["round3 F1 offer + can't make deadline", "offer", "Acme", hr, "Offer", "We're thrilled to extend you an offer! If you can't make the deadline, let us know."],
  ["round3 F1 offer + unfortunately", "offer", "Acme", hr, "Offer", "We are pleased to offer you the role. Unfortunately we cannot cover relocation for this position."],
  ["round3 F1 can't extend curly", "rejection", "Acme", hr, "Your Acme application", "Thank you for interviewing. We can’t extend an offer at this time."],
  ["round3 F1 won't be making", "rejection", "Acme", hr, "Your Acme application", "Thank you for interviewing. We won't be making an offer."],
  ["round3 F1 won’t be extending curly", "rejection", "Acme", hr, "Update", "We won’t be extending an offer at this time."],
  ["round3 F1 not able to extend", "rejection", "Acme", hr, "Update", "At this time we are not able to extend an offer."],
  ["round3 F1 will not be extending", "rejection", "Acme", hr, "Update", "We will not be extending an offer."],
  ["round3 F1 unable to extend", "rejection", "Acme", hr, "Update on your application", "Thank you for interviewing. We are unable to extend an offer at this time."],
  ["round3 F1 unfortunately unable to extend you", "rejection", "Acme", hr, "Update on your application", "Unfortunately, we are unable to extend you an offer for the Product Engineer role."],
  ["round3 F1 decided not to extend", "rejection", "Acme", hr, "Update on your application", "After careful consideration, we have decided not to extend an offer."],
  ["round3 F1 not in a position to extend", "rejection", "Acme", hr, "Update on your application", "We are not in a position to extend an offer at this time."],
  ["round3 F1 won't be able to offer you", "rejection", "Acme", hr, "Update on your application", "We won't be able to offer you the position."],
  ["round3 F2 transit interview", "other", "", "Metro Weekly <news@metroweekly.com>", "This week", "Our interview with a transit planner is up."],
  ["round3 F2 sports final round", "other", "", "Court Report <news@courtreport.com>", "Final round tonight", "Final round tonight at eight."],
  ["round3 F2 onsite workshop", "other", "", "Maker Space <hi@makerspace.org>", "Join our onsite workshop", "Join our onsite workshop on Saturday."],
  ["round3 F2 interview about her role", "other", "", "Metro Weekly <news@metroweekly.com>", "This week", "Read our interview with the mayor about her role in the transit plan."],
  ["round3 F2 nail your interview", "other", "", "Career Weekly <news@careerweekly.com>", "Nail your interview", "Five tips to prepare for your interview."],
  ["round3 F2 final round with role", "interview", "Acme", "Priya Shah <priya@acme.com>", "Final round", "Congrats on reaching the final round for the Product Engineer role. Please share your availability."],
  ["round3 F2 onsite invite", "interview", "Acme", "Acme Talent <talent@acme.com>", "Onsite", "We would like to invite you to an onsite interview."],
  ["round3 F2 your final round interview", "interview", "Acme", "Priya Shah <priya@acme.com>", "Your onsite", "Looking forward to your final round interview."],
  ["round3 F2 onsite schedule", "interview", "Acme", "Priya Shah <priya@acme.com>", "Your onsite schedule", "Here is your onsite schedule for Thursday. You will meet four engineers."],
  ["round3 F4 decided not to move forward", "rejection", "Acme", hr, "Thank you for applying", "We have decided not to move forward with your candidacy."],
  ["round3 F4 won't be moving forward", "rejection", "Acme", hr, "Update", "We won't be moving forward with your application."],
  ["round3 F4 not to proceed", "rejection", "Acme", hr, "Thank you for applying to Acme", "We have decided not to proceed with your application."],
  ["round3 F4 unable to move forward", "rejection", "Acme", hr, "Thank you for applying to Acme", "We are unable to move forward with your application at this time."],
  ["round3 F4 confirmation still applied", "applied", "Acme", "Acme <no-reply@greenhouse.io>", "Thank you for applying to Acme", "We received your application. If we decide to move forward, we will reach out."],
  ["round3 F5 easy apply", "applied", "Acme", "LinkedIn <jobs-noreply@linkedin.com>", "Your application was sent to Acme", "Your application was sent to Acme for the Designer role."],
  ["round3 F5 easy apply with name", "applied", "Acme", "LinkedIn <jobs-noreply@linkedin.com>", "Sam, your application was sent to Acme", "Acme · Austin, TX"],
  ["round3 F6 codesignal fixture", "assessment", "Acme", "CodeSignal <no-reply@codesignal.com>", "Your CodeSignal assessment", "Acme invited you to take a CodeSignal assessment."],
  ["round3 F6 codesignal your acme", "assessment", "Acme", "CodeSignal <noreply@codesignal.com>", "Complete your Acme assessment", "Please complete it within 7 days."],
  ["round3 F6 hackerrank from", "assessment", "Acme", "HackerRank Tests <no-reply@hackerrank.com>", "Test invitation from Acme", "You have been invited to a HackerRank test."],
  ["round3 F6 hackerrank by", "assessment", "Acme", "HackerRank <support@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test."],
  ["round3 F6 hackerrank has invited", "assessment", "Acme", "HackerRank <support@hackerrank.com>", "Coding test", "Acme has invited you to take a HackerRank test for the role."],
  ["round3 F6 greenhouse vendor display", "applied", "Acme", "Greenhouse <no-reply@greenhouse.io>", "Thanks for applying to Acme", "We received your application."],
  ["round3 F6 single name person", "screen", "Acme", "Priya <priya@acme.com>", "Phone screen", "Can we set up a phone screen?"],
  ["round3 F6 single name co.uk", "screen", "Acme", "Priya <priya@acme.co.uk>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["round3 F6 company co.uk", "interview", "Acme", "Acme Talent <talent@acme.co.uk>", "Interview invitation", "We would like to invite you to an interview for the role."],
  ["round3 F6 single-word company display", "applied", "Acme", "Acme <jobs@acme.com>", "Thanks for applying to Acme", "We got it."],
  ["round3 F6 single-word company, local=company", "applied", "Acme", "Acme <acme@myworkday.com>", "Thanks for applying to Acme", "We got it."],
  ["round3 F6 com.au", "screen", "Acme", "Priya Shah <priya@acme.com.au>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["round3 F7 winter flavors", "other", "", "Frost Boxes <hi@frostboxes.com>", "Winter", "We're excited to introduce you to our new winter flavors."],
  ["round3 F7 product name intro", "other", "", "Pixelbox <team@pixelbox.example>", "Something new", "We're excited to introduce you to Pixelbox Calendar."],
  ["round3 F7 come meet santa", "other", "", "Toy Barn <hi@toybarn.com>", "Holiday hours", "Come meet Santa this Saturday at our downtown store."],
  ["round3 F7 support connect", "other", "", "Acme Support <support@acmebank.com>", "Your ticket", "We can connect you with a specialist if you reply to this email."],
  ["round3 F7 real intro", "intro", "", "Jo Lin <jo@friend.org>", "Meet Sam", "I would like to introduce you to Sam, a founder in your area."],
  ["round3 F7 intro you two", "intro", "", "Jordan Lee <jordan@gmail.com>", "Sam <> Priya (Acme)", "Hi both, I wanted to introduce you two."],
  ["round3 F7 meet priya", "intro", "", "Jo Lin <jo@friend.org>", "Hello", "I think you should meet Priya, she runs a small studio."],
  ["round3 F8 push the interview", "interview", "Acme", "Priya Shah <priya@acme.com>", "Schedule", "Unfortunately our interviewer is out sick. Can we push the interview for the role to Friday?"],
  ["round3 F8 another time", "interview", "Acme", "Acme Talent <talent@acme.com>", "Your interview", "Unfortunately the panel is unavailable. Could we find another time for your interview for the role?"],
  ["round3 F8 rejection after interview, different direction", "rejection", "Acme", hr, "Your application to Acme", "Thank you for taking the time to interview with us. Unfortunately, we have decided to move in a different direction for this role."],
  ["round3 F8 rejection after interview, a candidate", "rejection", "Acme", hr, "Your application to Acme", "Thank you for interviewing for the Product Engineer role. Unfortunately, we have decided to move forward with a candidate whose experience more closely matches our needs."],
  ["round3 F8 rejection after interview, moved", "rejection", "Acme", hr, "Your application to Acme", "Thanks for your interview last week. Unfortunately the role has been removed from our plans this quarter."],
  ["round3 F8 rejection after interview, plain", "rejection", "Acme", hr, "Your application to Acme", "Thank you for interviewing with us. Unfortunately we will not be continuing with your candidacy."],
  ["contractions cant extend", "rejection", "Acme", hr, "Update from Acme", "Thank you for interviewing. We can't extend an offer at this time."],
  ["contractions wont make", "rejection", "Acme", hr, "Update from Acme", "Thank you for interviewing. We won't be making an offer."],
  ["contractions unable", "rejection", "Acme", hr, "Update from Acme", "Thank you for interviewing. We are unable to extend an offer."],
  ["contractions will not extending", "rejection", "Acme", hr, "Update from Acme", "Thank you for interviewing. We will not be extending an offer."],
  ["contractions travel plans", "offer", "Acme", hr, "Update from Acme", "We are pleased to offer you the role. Please do not make any travel plans until you sign."],
  ["contractions better choice", "offer", "Acme", hr, "Update from Acme", "We are pleased to offer you the role. You can't make a better choice!"],
  ["contractions signing bonus", "offer", "Acme", hr, "Update from Acme", "We would like to offer you the position. We are not offering a signing bonus for this level."],
  ["oos high volume applied", "applied", "Acme", "Acme <no-reply@greenhouse.io>", "Thank you for applying to Acme", "We received your application. Unfortunately, due to the high volume of applications, we cannot respond to every candidate individually."],
  ["oos middle initial", "screen", "Acme", "Priya K. Shah <priya@acme.com>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["oos unable plus candidate", "rejection", "Acme", hr, "Your application to Acme", "Thank you for interviewing. We are unable to extend an offer, and we have decided to move forward with a candidate whose experience fits."],
];

function mail(id: string, from: string, subject: string, body: string, date: string): InboxEmail {
  return { id, from, subject, body, date };
}

describe("classifier battery", () => {
  for (const [label, kind, company, from, subject, body] of CASES) {
    it(label, () => {
      const event = classifyEmail(mail(label, from, subject, body, "2026-10-20T10:00:00.000Z"));
      expect(event.kind).toBe(kind);
      if (company) expect(event.company).toBe(company);
    });
  }

  it("folds a hosted sequence into one Acme row", () => {
    const events = [
      mail("a", "Acme <no-reply@greenhouse.io>", "Thank you for applying to Acme", "Your application has been received.", "2026-10-01T10:00:00.000Z"),
      mail("b", "CodeSignal <noreply@codesignal.com>", "Acme invited you to a General Coding Assessment", "Acme has invited you to take a coding assessment on CodeSignal.", "2026-10-05T10:00:00.000Z"),
      mail("c", "Priya Shah <priya@acme.com>", "Next steps", "Can we set up a phone screen this week?", "2026-10-10T10:00:00.000Z"),
      mail("d", "HackerRank <support@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test.", "2026-10-12T10:00:00.000Z"),
    ].map(classifyEmail);
    const rows = buildPipeline(events, "2026-11-01").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Acme");
  });

  it("keeps a three email interview sequence on the jobs lane", () => {
    const events = [
      mail("a", "Acme Careers <careers@acme.com>", "Thanks for applying for the Product Engineer role at Acme", "We received your application.", "2026-10-01T10:00:00.000Z"),
      mail("b", "Acme Talent <talent@acme.com>", "Interview with Acme", "We would like to invite you to interview with our co-founder.", "2026-10-10T10:00:00.000Z"),
      mail("c", "Priya Shah <priya@acme.com>", "Your onsite", "Looking forward to your final round interview.", "2026-10-15T10:00:00.000Z"),
    ].map(classifyEmail);
    const rows = buildPipeline(events, "2026-11-07").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].furthest).toBe("interview");
    expect(rows[0].lane).toBe("jobs");
  });
});
