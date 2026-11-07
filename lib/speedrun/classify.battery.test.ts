import { describe, expect, it } from "vitest";
import { classifyEmail } from "./classify";
import { buildPipeline } from "./pipeline";
import type { EventKind, InboxEmail } from "./types";

// A regression battery for the inbox reader: one realistic, made-up email per
// row. Columns: label, expected kind, expected company ("" when it does not
// matter), from, subject, body. Add a row for every real-world miss.
// Every sender is made up. Companies, people, shops and newsletters live on the
// reserved .example host (gmail.example stands in for a friend's webmail); only
// hiring platforms keep their real no-reply hosts. The country-domain rows test
// .co.uk and .com.au parsing on invented labels (Qorvanthe, Brellquist) that
// had no DNS records when they were written.
const hr = "Acme Careers <careers@acme.example>";
const tw = "Tidewell Careers <careers@tidewell.example>";
const CASES: Array<[string, EventKind, string, string, string, string]> = [
  ["battery applied:greenhouse", "applied", "Acme", "Acme <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Acme", "Hi Sam,\nThank you for applying to Acme! Your application has been received and we will review it shortly.\n\nBest,\nThe Acme Team"],
  ["battery applied:lever", "applied", "Acme", "Acme <no-reply@hire.lever.co>", "Thank you for your application to Acme", "Hi Sam, thanks for your interest in the Software Engineer role at Acme. We've received your application and will be in touch."],
  ["battery applied:workday", "applied", "Acme", "Acme Careers <acme@myworkday.com>", "Application confirmation", "Thank you for applying for Software Engineer, New Grad. We have successfully received your submission."],
  ["battery assessment:codesignal", "assessment", "Acme", "CodeSignal <noreply@codesignal.com>", "Acme invited you to a General Coding Assessment", "Acme has invited you to take a coding assessment on CodeSignal. Please complete it within 7 days."],
  ["battery assessment:hackerrank", "assessment", "Acme", "HackerRank <no-reply@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test. Test duration: 90 minutes."],
  ["battery interview:sched", "interview", "Acme", "Priya Shah <priya.shah@acme.example>", "Next steps with Acme", "Hi Sam, the team enjoyed your phone screen and would like to move you to the onsite. Please use this link to pick a time for your interviews."],
  ["battery interview:ashby", "interview", "Acme", "Acme Hiring Team <no-reply@ashbyhq.com>", "Schedule your interview with Acme", "Hi Sam, please select a time for your technical interview with our engineering team."],
  ["battery interview:reschedule", "interview", "Acme", "Acme Talent <talent@acme.example>", "Rescheduling your interview", "Hi Sam, unfortunately our interviewer is out sick tomorrow. Could we move your interview to Thursday?"],
  ["battery offer:plain", "offer", "Acme", "Acme Hiring <hiring@acme.example>", "Your offer from Acme", "Hi Sam, we're thrilled to extend you an offer to join Acme as a Product Engineer. Details attached."],
  ["battery offer:verbal", "offer", "Acme", "Priya Shah <priya.shah@acme.example>", "Great news", "Hi Sam, congratulations! We would like to offer you the Product Engineer role. Let's find a time to go over the details."],
  ["battery rejection:regret", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Your application to Acme", "Hi Sam, thank you for applying. We regret to inform you that we have decided to pursue other candidates for this role."],
  ["battery rejection:unable-extend", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Update on your Acme application", "Hi Sam, thank you for interviewing with us. At this time we are not able to extend an offer, but we enjoyed meeting you."],
  ["battery rejection:filled", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Software Engineer position", "Thank you for your interest. The position has been filled and we will not be proceeding with your application."],
  ["battery rejection:other-cands", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Regarding your application", "After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our needs."],
  ["battery intro:introduce", "intro", "", "Jordan Lee <jordan.lee@gmail.example>", "Sam <> Priya (Acme)", "Hi both, I wanted to introduce you two. Priya is building Acme and is hiring a founding engineer. I'll let you take it from here."],
  ["battery intro:intro-colon", "intro", "", "Jordan Lee <jordan.lee@gmail.example>", "Intro: Sam / Priya", "Priya, meet Sam. Sam, meet Priya."],
  ["battery other:calendar-interview", "other", "", "Team Calendar <invites@calendar.example>", "Invitation: Interview with Acme @ Tue Nov 10, 2026 2pm - 3pm (CST) (sam@example.com)", "You have been invited to the following event. Join the video call from the event page."],
  ["battery other:calendar-generic", "other", "", "Team Calendar <invites@calendar.example>", "Invitation: Dentist @ Wed Nov 11, 2026 9am", "You have been invited to the following event."],
  ["battery other:newsletter-unfortunately", "other", "", "Weeknight Table <news@weeknighttable.example>", "Holiday box update", "Unfortunately our holiday box sold out. Here are three dinners you can make with pantry staples."],
  ["battery other:newsletter-interview", "other", "", "The Commuter <letters@thecommuter.example>", "Our interview with a transit planner", "This week we sat down for an interview about why buses bunch."],
  ["battery other:newsletter-assessment", "other", "", "Craft Notes <craft@notes.example>", "How to run a product assessment", "A framework for honest product reviews."],
  ["battery other:jobboard-digest", "other", "", "LinkedIn <jobs-noreply@linkedin.com>", "30 new jobs for Software Engineer", "Apply now: Software Engineer at Acme. Your application could be next. Easy Apply."],
  ["battery X offer+not-able-to-make", "offer", "Acme", "Acme Hiring <hiring@acme.example>", "Your offer from Acme", "We are pleased to offer you the Product Engineer position. If you are not able to make the January 5 start date, let us know."],
  ["battery X offer+cannot-offer-reloc", "offer", "Acme", "Acme Hiring <hiring@acme.example>", "Offer letter", "We are pleased to offer you the role. We cannot offer relocation support, but the base salary is attached."],
  ["battery X won't be extending", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Your Acme application", "Thank you for interviewing. We won't be extending an offer at this time."],
  ["battery X curly can't extend", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Your Acme application", "Thank you for interviewing. We can’t extend an offer at this time."],
  ["battery X decided not to move fwd", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Thank you for applying to Acme", "After careful review, we have decided not to move forward with your candidacy."],
  ["battery X won't be moving fwd", "rejection", "Acme", "Acme Careers <careers@acme.example>", "Your application to Acme", "We won't be moving forward with your application."],
  ["battery X marketing introduce you", "other", "", "Frost Boxes <hi@frostboxes.example>", "Meet the winter box", "We're excited to introduce you to our new winter flavors."],
  ["battery X newsletter final round", "other", "", "Fairway Nightly <daily@fairwaynightly.example>", "Final round tonight", "The final round tees off at 2pm."],
  ["battery X newsletter onsite", "other", "", "Gridline Notes <hi@gridlinenotes.example>", "Join our onsite workshop", "Our onsite workshop is in Austin this month."],
  ["battery X interview push role", "interview", "Acme", "Acme Talent <talent@acme.example>", "Interview time", "Unfortunately our interviewer is out sick. Can we push the interview for the role to Friday?"],
  ["battery X single-name person", "interview", "Acme", "Priya <priya@acme.example>", "Final round", "Looking forward to your final round."],
  ["battery X person mid initial", "interview", "Acme", "Priya K. Shah <priya@acme.example>", "Final round", "Looking forward to your final round."],
  ["battery X linkedin easy apply", "applied", "Acme", "LinkedIn <jobs-noreply@linkedin.com>", "Sam, your application was sent to Acme", "Your application was sent to Acme. Software Engineer."],
  ["battery X ccTLD", "interview", "Qorvanthe", "Qorvanthe Talent <talent@qorvanthe.co.uk>", "Interview invitation", "We would like to invite you to an interview for the role."],
  ["battery X ccTLD person", "interview", "Qorvanthe", "Priya Shah <priya@qorvanthe.co.uk>", "Final round", "Looking forward to your final round."],
  ["battery X confirm+assessment", "assessment", "Acme", "Acme Careers <careers@acme.example>", "Thank you for applying to Acme", "Next step: please complete the HackerRank assessment within 5 days."],
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
  ["round3 F2 transit interview", "other", "", "Busline Bulletin <news@buslinebulletin.example>", "This week", "Our interview with a transit planner is up."],
  ["round3 F2 sports final round", "other", "", "Baseline Courtside <news@baselinecourtside.example>", "Final round tonight", "Final round tonight at eight."],
  ["round3 F2 onsite workshop", "other", "", "Solder Loft <hi@solderloft.example>", "Join our onsite workshop", "Join our onsite workshop on Saturday."],
  ["round3 F2 interview about her role", "other", "", "Busline Bulletin <news@buslinebulletin.example>", "This week", "Read our interview with the mayor about her role in the transit plan."],
  ["round3 F2 nail your interview", "other", "", "Ladder Letters <news@ladderletters.example>", "Nail your interview", "Five tips to prepare for your interview."],
  ["round3 F2 final round with role", "interview", "Acme", "Priya Shah <priya@acme.example>", "Final round", "Congrats on reaching the final round for the Product Engineer role. Please share your availability."],
  ["round3 F2 onsite invite", "interview", "Acme", "Acme Talent <talent@acme.example>", "Onsite", "We would like to invite you to an onsite interview."],
  ["round3 F2 your final round interview", "interview", "Acme", "Priya Shah <priya@acme.example>", "Your onsite", "Looking forward to your final round interview."],
  ["round3 F2 onsite schedule", "interview", "Acme", "Priya Shah <priya@acme.example>", "Your onsite schedule", "Here is your onsite schedule for Thursday. You will meet four engineers."],
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
  ["round3 F6 hackerrank by", "assessment", "Acme", "HackerRank <no-reply@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test."],
  ["round3 F6 hackerrank has invited", "assessment", "Acme", "HackerRank <no-reply@hackerrank.com>", "Coding test", "Acme has invited you to take a HackerRank test for the role."],
  ["round3 F6 greenhouse vendor display", "applied", "Acme", "Greenhouse <no-reply@greenhouse.io>", "Thanks for applying to Acme", "We received your application."],
  ["round3 F6 single name person", "screen", "Acme", "Priya <priya@acme.example>", "Phone screen", "Can we set up a phone screen?"],
  ["round3 F6 single name co.uk", "screen", "Qorvanthe", "Priya <priya@qorvanthe.co.uk>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["round3 F6 company co.uk", "interview", "Qorvanthe", "Qorvanthe Talent <talent@qorvanthe.co.uk>", "Interview invitation", "We would like to invite you to an interview for the role."],
  ["round3 F6 single-word company display", "applied", "Acme", "Acme <jobs@acme.example>", "Thanks for applying to Acme", "We got it."],
  ["round3 F6 single-word company, local=company", "applied", "Acme", "Acme <acme@myworkday.com>", "Thanks for applying to Acme", "We got it."],
  ["round3 F6 com.au", "screen", "Brellquist", "Priya Shah <priya@brellquist.com.au>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["round3 F7 winter flavors", "other", "", "Frost Boxes <hi@frostboxes.example>", "Winter", "We're excited to introduce you to our new winter flavors."],
  ["round3 F7 product name intro", "other", "", "Pixelbox <team@pixelbox.example>", "Something new", "We're excited to introduce you to Pixelbox Calendar."],
  ["round3 F7 come meet santa", "other", "", "Whirligig Toyshop <hi@whirligigtoys.example>", "Holiday hours", "Come meet Santa this Saturday at our downtown store."],
  ["round3 F7 support connect", "other", "", "Acme Support <support@acmebank.example>", "Your ticket", "We can connect you with a specialist if you reply to this email."],
  ["round3 F7 real intro", "intro", "", "Jo Lin <jo@jolin.example>", "Meet Sam", "I would like to introduce you to Sam, a founder in your area."],
  ["round3 F7 intro you two", "intro", "", "Jordan Lee <jordan.lee@gmail.example>", "Sam <> Priya (Acme)", "Hi both, I wanted to introduce you two."],
  ["round3 F7 meet priya", "intro", "", "Jo Lin <jo@jolin.example>", "Hello", "I think you should meet Priya, she runs a small studio."],
  ["round3 F8 push the interview", "interview", "Acme", "Priya Shah <priya@acme.example>", "Schedule", "Unfortunately our interviewer is out sick. Can we push the interview for the role to Friday?"],
  ["round3 F8 another time", "interview", "Acme", "Acme Talent <talent@acme.example>", "Your interview", "Unfortunately the panel is unavailable. Could we find another time for your interview for the role?"],
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
  ["oos middle initial", "screen", "Acme", "Priya K. Shah <priya@acme.example>", "Phone screen", "Can we set up a phone screen for the role?"],
  ["oos unable plus candidate", "rejection", "Acme", hr, "Your application to Acme", "Thank you for interviewing. We are unable to extend an offer, and we have decided to move forward with a candidate whose experience fits."],
  // Round 4, fresh probe: realistic made-up mail end to end.
  ["fresh G1 greenhouse confirmation", "applied", "Brindle Labs", "Brindle Labs <no-reply@us.greenhouse-mail.io>", "Thank you for your application to Brindle Labs", "Hi Sam,\n\nThanks for your interest in Brindle Labs! We wanted to let you know we received your application for Software Engineer, Platform, and we are delighted that you would consider joining our team.\n\nOur team will review your application and will be in touch if your qualifications match our needs for the role. If you are not selected for this position, keep an eye on our jobs page as we're growing and adding openings.\n\nRegards,\nBrindle Labs"],
  ["fresh G2 lever confirmation", "applied", "Quillpoint", "Quillpoint <no-reply@hire.lever.co>", "Quillpoint: thanks for applying!", "Hi Sam,\n\nThank you for applying to the Product Engineer (New Grad) position at Quillpoint. We've received your application and our team will review it shortly. We'll reach out if there's a fit.\n\nBest,\nThe Quillpoint Team"],
  ["fresh G3 ashby confirmation", "applied", "Copperline", "Copperline <no-reply@ashbyhq.com>", "Thanks for applying to Copperline", "Hi Sam,\n\nThanks so much for your interest in the Frontend Engineer role at Copperline. This email confirms we've received your application. We review every application carefully and will get back to you within two weeks.\n\nCopperline Talent"],
  ["fresh G4 codesignal assessment", "assessment", "Tidewell", "CodeSignal <noreply@codesignal.com>", "Tidewell has invited you to take a Coding Assessment", "Hi Sam,\n\nTidewell has invited you to complete the General Coding Assessment as the next step in your application for Software Engineer Intern. The assessment takes 70 minutes. Please complete it by November 14, 2026.\n\nGood luck!\nThe CodeSignal Team"],
  ["fresh G5 take-home from hiring mailbox", "assessment", "Harrow & Vale", "Harrow & Vale Hiring <hiring@harrowvale.example>", "Next step: take-home exercise", "Hi Sam,\n\nThanks for chatting with us last week. As a next step in your application, we'd like you to complete a short take-home exercise. You'll have 72 hours from when you open the link.\n\nBest,\nHarrow & Vale Hiring"],
  ["fresh G6 phone screen ask", "screen", "Marrowbyte", "Nadia Okafor <nadia.okafor@marrowbyte.example>", "Marrowbyte <> Sam", "Hi Sam,\n\nI'm a recruiter at Marrowbyte and came across your application for our Data Engineer role. Would you be open to a 30 minute phone screen this week? Here's my calendar link to grab a time that works.\n\nThanks,\nNadia"],
  ["fresh G7 scheduling mailbox onsite", "interview", "Quillpoint", "Quillpoint Scheduling <scheduling@quillpoint.example>", "Action required: schedule your virtual onsite with Quillpoint", "Hi Sam,\n\nCongratulations on moving forward! We'd like to invite you to a virtual onsite for the Product Engineer position. It will include four 45 minute interviews with members of the team. Please select your availability using the link below.\n\nQuillpoint Scheduling"],
  ["fresh G8 interview confirmation details", "interview", "Copperline", "Theo Brandt <theo@copperline.example>", "Interview confirmation: Tuesday 11/17", "Hi Sam,\n\nConfirming your technical interview on Tuesday, November 17 at 1pm CT with two engineers from the platform team. The video link is in the calendar invite. Let me know if anything comes up.\n\nTheo"],
  ["fresh G9 rejection after applying", "rejection", "Brindle Labs", "Brindle Labs <no-reply@us.greenhouse-mail.io>", "Your application to Brindle Labs", "Hi Sam,\n\nThank you for your interest in Brindle Labs and for taking the time to apply for the Software Engineer, Platform role. After reviewing your application, we have decided to pursue other candidates whose experience more closely aligns with our current needs.\n\nWe wish you the best in your search.\n\nBrindle Labs"],
  ["fresh G10 rejection after onsite", "rejection", "Quillpoint", "Ines Carvalho <ines.carvalho@quillpoint.example>", "Quillpoint follow-up", "Hi Sam,\n\nThank you again for spending time with the team last week. Everyone enjoyed meeting you. Unfortunately, we've decided not to move forward with an offer at this time. It was a close call, and we would welcome an application from you in the future.\n\nAll the best,\nInes"],
  ["fresh G11 rejection, keep on file", "rejection", "Tidewell", "Tidewell Talent <talent@tidewell.example>", "Update on your Tidewell application", "Hi Sam,\n\nThank you for applying for the Software Engineer Intern position. We received many strong applications and, after careful review, we will not be moving forward with yours at this time. We'll keep your resume on file for future openings.\n\nTidewell Talent"],
  ["fresh G12 offer email", "offer", "Copperline", "Theo Brandt <theo@copperline.example>", "Offer from Copperline", "Hi Sam,\n\nI'm so happy to share that we'd love to have you join Copperline as a Frontend Engineer! Your offer letter is attached, including base salary, equity and benefits. Please review it and let me know if you have any questions. We'd ask for a decision by November 20.\n\nTheo"],
  ["fresh G13 warm intro from a friend", "intro", "", "Wes Hartigan <wes.hartigan@gmail.example>", "Intro: Sam <> Nadia (Marrowbyte)", "Hi Nadia, meet Sam, a new grad I worked with at a hackathon who is looking at data roles. Sam, Nadia leads engineering hiring at Marrowbyte. I'll let you two take it from here.\n\nWes"],
  ["fresh G14 newsletter, career advice", "other", "", "The Early Shift <hello@theearlyshift.example>", "5 questions to ask at the end of every interview", "This week: the five questions hiring managers wish more candidates asked, plus a template for a thank-you note after your final round. Read time: 4 minutes."],
  ["fresh G15 newsletter, product marketing", "other", "", "Lumen Notes <team@lumennotes.example>", "New in Lumen: meet Focus Mode", "We're excited to introduce Focus Mode, a quieter way to write. Meet the new sidebar, schedule distraction-free blocks, and assess your writing streaks at a glance."],
  // Round 4, F1: a mailbox name after the company keeps only the words that spell the domain.
  ["round4 F1 talent acquisition mailbox", "interview", "Tidewell", "Tidewell Talent Acquisition <ta@tidewell.example>", "Your onsite", "We'd like to invite you to an onsite interview. Please share your availability."],
  ["round4 F1 university programs mailbox", "assessment", "Harrow & Vale", "Harrow & Vale University Programs <campus@harrowvale.example>", "Next step: take-home exercise", "As a next step in your application, we'd like you to complete a short take-home exercise."],
  ["round4 F1 display that does not spell the domain", "applied", "Fernhollow Health", "Fernhollow Health Careers <jobs@fhh.example>", "Thanks for applying to Fernhollow Health", "We received your application."],
  // F2: an assessment beats a confirmation subject only when the email asks for it now.
  ["round4 F2 confirmation mentions a possible assessment", "applied", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "Hi Sam,\nThanks for applying! We've received your application.\n\nNext steps: our team reviews every application. If your background is a match, you'll receive an invitation to complete an online assessment.\n\nTidewell"],
  ["round4 F2 confirmation describes the process", "applied", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application for Software Engineer Intern. The next step in our process is usually a short coding assessment, which we send to shortlisted candidates."],
  ["round4 F2 link sits in another sentence", "applied", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application. You can track its status with the link below. If there is a match, the next step may be a short coding assessment."],
  ["round4 F2 confirmation asks now, link", "assessment", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We've received your application. Next step: please complete the HackerRank assessment within 5 days using the link below."],
  ["round4 F2 confirmation asks now, date", "assessment", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We've received your application. As a next step, complete the online assessment by November 14."],
  ["round4 F2 confirmation asks now, click", "assessment", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We've received your application. Click the button below to start your coding assessment."],
  // F3: "for the <Role> role" is read in its original case, so an untrusted company sender still counts.
  ["round4 F3 no-reply final round for the role", "interview", "Tidewell", "Tidewell <no-reply@tidewell.example>", "Your final round", "Congrats on reaching the final round for the Software Engineer role. Your schedule is attached."],
  ["round4 F3 scheduling tool onsite", "interview", "Tidewell", "Tidewell <scheduling@goodtime.io>", "Pick times for your onsite", "Please pick times for your onsite for the Software Engineer role at Tidewell."],
  ["round4 F3 newsletter role in lower case", "other", "", "Busline Bulletin <news@buslinebulletin.example>", "Final round", "The final round of the bus redesign is out, and our planner explains her role."],
  // F4: intros from friends' personal addresses.
  ["round4 F4 pair subject, webmail handle", "intro", "", "Jordan Lee <jl.builds@gmail.example>", "Sam <> Priya (Brindle Labs)", "Priya, meet Sam. Sam, meet Priya. Over to you both!"],
  ["round4 F4 webmail meet, no pair subject", "intro", "", "Jordan Lee <jl.builds@gmail.example>", "Someone you should know", "Priya, meet Sam. Sam, meet Priya."],
  ["round4 F4 pair subject, name handle", "intro", "", "Jordan Lee <jordan.lee@gmail.example>", "Sam <> Priya (Brindle Labs)", "Priya, meet Sam. Sam, meet Priya. Over to you both!"],
  ["round4 F4 pair subject, vanity domain", "intro", "", "Maya Torres <hi@mayatorres.example>", "Sam <> Priya", "Priya, meet Sam. Sam, meet Priya."],
  ["round4 F4 first person intro, vanity domain", "intro", "", "Maya Torres <hi@mayatorres.example>", "Intro to Priya at Brindle Labs", "Hi Sam, I'd love to introduce you to Priya. She runs engineering at Brindle Labs and is hiring."],
  ["round4 F4 pair subject from a newsletter", "other", "", "Gridline Notes <news@gridlinenotes.example>", "Design <> Engineering: closing the gap", "Five habits of teams that ship."],
  // F6: post-interview rejections without "unfortunately".
  ["round4 F6 not be offering you a position", "rejection", "Tidewell", tw, "Your Tidewell interview", "Thank you for interviewing with us. After much deliberation, we will not be offering you a position at this time."],
  ["round4 F6 go in a different direction", "rejection", "Tidewell", tw, "Following up", "Thanks for taking the time to interview with the team. We've decided to go in a different direction for this role."],
  ["round4 F6 won't be able to move forward", "rejection", "Tidewell", tw, "Following up", "Thank you for interviewing with Tidewell. We won't be able to move forward with your candidacy."],
  ["round4 F6 have not been selected", "rejection", "Tidewell", tw, "Your Tidewell application", "Thank you for your interest in the Software Engineer position. After careful review, you have not been selected to move forward in the process."],
  ["round4 F6 chosen another candidate", "rejection", "Tidewell", tw, "Following up", "Thank you for interviewing with us. We have chosen another candidate for the role."],
  ["round4 F6 will not be able to proceed", "rejection", "Tidewell", tw, "Your Tidewell application", "We will not be able to proceed with your application at this time."],
  ["round4 F6 decided not to pursue", "rejection", "Tidewell", tw, "Your Tidewell application", "After reviewing your application, we have decided not to pursue your candidacy further."],
  ["round4 F6 unfortunately, different direction", "rejection", "Tidewell", tw, "Following up", "Thanks for interviewing with the team. Unfortunately, we've decided to go in a different direction for this role."],
  ["round4 F6 unfortunately, not offering", "rejection", "Tidewell", tw, "Following up", "Thank you for interviewing. Unfortunately, we will not be offering you a position."],
  ["round4 F6 if not selected stays applied", "applied", "Tidewell", tw, "Thank you for applying to Tidewell", "We received your application. If you have not been selected within four weeks, the role may have closed."],
  ["round4 F6 reschedule a phone screen", "screen", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Rescheduling our call", "Hi Sam, unfortunately something came up. Could we reschedule our phone screen for the Data Engineer role to Thursday?"],
  ["round4 F6 greenhouse person display", "interview", "Tidewell", "Priya Shah <no-reply@us.greenhouse-mail.io>", "Next steps with Tidewell", "Hi Sam, the team enjoyed your phone screen and would like to move you to the onsite interviews. Please share your availability."],
  ["round4 F6 workable confirmation", "applied", "Brindle Labs", "Brindle Labs <noreply@candidates.workablemail.com>", "Thanks for applying to Brindle Labs", "Your application for the Data Analyst job was submitted."],
  ["round4 F6 smartrecruiters person display", "interview", "Copperline", "Ines Carvalho <no-reply@smartrecruiters.com>", "Interview with Copperline", "Please pick a time for your interview for the Frontend Engineer role."],
  ["round4 F6 icims person display", "interview", "Marrowbyte", "Theo Brandt <no-reply@talent.icims.com>", "Next steps with Marrowbyte", "Please share your availability for a final round."],
  ["round4 F6 jobvite person display", "screen", "Quillpoint", "Nadia Okafor <notifications@jobvite.com>", "Phone screen with Quillpoint", "Can we set up a phone screen this week?"],
  ["round4 F6 modernloop person display", "interview", "Tidewell", "Wes Hartigan <scheduling@modernloop.io>", "Your onsite with Tidewell", "Please confirm the times for your onsite for the Product Engineer role."],
  // Newsletters that talk about interviews, and calendar invitations by shape.
  ["round4 newsletter candidate words", "other", "", "The Early Shift <hello@theearlyshift.example>", "Interview season", "Every candidate should prepare three stories before an interview. Plus: how to follow up on an application."],
  ["round4 newsletter mock interview", "other", "", "Prepwell <team@prepwell.example>", "Ace the next one", "Schedule a mock interview with a coach this week and get 20 percent off."],
  ["round4 calendar shape, any tool", "other", "", "Slotwise <invites@slotwise.example>", "Invitation: Interview with Acme @ Tue Nov 10, 2026 2pm - 3pm (CST)", "You have been invited to the following event."],
  ["round4 calendar company name is not a calendar", "applied", "Calendarly", "Calendarly Careers <jobs@calendarly.example>", "Thanks for applying to Calendarly", "We received your application."],
  // Round 5, fresh probe: ten more realistic made-up emails end to end.
  ["fresh5 E1 workday confirmation with req id", "applied", "Fernhollow Health", "Fernhollow Health <fernhollowhealth@myworkday.com>", "We've received your application for Software Engineer I (R-04512)", "Dear Sam,\n\nThank you for your interest in Fernhollow Health. This email confirms that we have received your application for Software Engineer I (Req ID R-04512). Our talent acquisition team will review your qualifications and contact you if there is a match.\n\nYou can check the status of your application at any time by signing in to your candidate home.\n\nSincerely,\nFernhollow Health Talent Acquisition"],
  ["fresh5 E2 take-home from hiring manager", "assessment", "Quillpoint", "Ravi Anand <ravi@quillpoint.example>", "Take-home exercise", "Hi Sam,\n\nGreat chatting yesterday! As promised, here is the take-home for the Data Engineer role. It should take about three hours; please send your solution back by end of day Friday. The prompt and starter repo are here: https://files.quillpoint.example/takehome\n\nShout if anything is unclear.\nRavi"],
  ["fresh5 E3 screen from Name from Company", "screen", "Brindle Labs", "Lena from Brindle Labs <lena@brindlelabs.example>", "Quick chat about the Backend Engineer role?", "Hi Sam,\n\nThanks for applying to the Backend Engineer role at Brindle Labs! I'd love to set up a 30 minute intro call to learn more about what you're looking for and walk you through the process. You can grab any open slot here: https://cal.example/lena-brindle\n\nTalk soon,\nLena"],
  ["fresh5 E4 offer went to another candidate", "rejection", "Haldenrobotics", "Marco Bellini <marco.bellini@haldenrobotics.example>", "Following up on your final round", "Hi Sam,\n\nThank you for the time you spent with us during the final round last week. The team really enjoyed meeting you. After a lot of discussion, we've decided to extend an offer to another candidate whose background is a closer match for this role. This was a tough call, and I'd be glad to stay in touch.\n\nBest,\nMarco"],
  ["fresh5 E5 offer attached, DocuSign", "offer", "Copperline", "Priya Raman <priya@copperline.example>", "Congratulations, Sam!", "Hi Sam,\n\nIt was great speaking with you this afternoon. As promised, I'm attaching your offer for the Software Engineer, New Grad position at Copperline, including base salary, equity and your start date. Please review and sign through DocuSign by Friday, November 20. Happy to set up a call with the team if you have any questions.\n\nCongratulations again!\nPriya"],
  ["fresh5 E6 coordinator asks for interview windows", "interview", "Larkfield", "Mira Patel <mira.patel@larkfield.example>", "Larkfield | Technical interview availability", "Hi Sam,\n\nThanks for taking the time to speak with Jonah on Monday. We'd like to move you forward to a 60 minute technical interview with two engineers on the payments team. Could you send me three or four windows that work for you next week (Central time)?\n\nThanks,\nMira Patel\nTalent Coordinator, Larkfield"],
  ["fresh5 E7 codility coding test", "assessment", "Marrowbyte", "Codility <no-reply@codility.com>", "Invitation to a coding test from Marrowbyte", "Hello Sam,\n\nMarrowbyte has invited you to take a coding test as part of their hiring process for the Junior Backend Developer position. The test takes 90 minutes and must be completed in one sitting.\n\nPlease complete the test before November 14, 2026, 23:59 CET.\n\nStart the test: https://app.codility.com/test/demo\n\nGood luck!\nThe Codility Team"],
  ["fresh5 E8 workday rejection, no unfortunately", "rejection", "Fernhollow Health", "Fernhollow Health <fernhollowhealth@myworkday.com>", "Regarding your application for Data Analyst (R-03977)", "Dear Sam,\n\nThank you for your interest in the Data Analyst position at Fernhollow Health. After careful review, we have decided to move forward with candidates whose qualifications more closely match the needs of the role.\n\nWe appreciate the time you invested in applying and encourage you to explore other openings on our careers site.\n\nSincerely,\nFernhollow Health Talent Acquisition"],
  ["fresh5 E9 professor connects you", "intro", "", "Elena Ruiz <elena.ruiz@stateu.example>", "Connecting you with Marco (Halden Robotics)", "Hi Marco and Sam,\n\nAs promised, connecting the two of you. Marco leads the autonomy team at Halden Robotics and is hiring new grads this spring. Sam was one of the strongest students in my robotics seminar this fall and has been building a small drone mapping project.\n\nI'll let you two take it from here.\n\nBest,\nElena"],
  ["fresh5 E10 onsite logistics from a company no-reply", "interview", "Larkfield", "Larkfield <no-reply@larkfield.example>", "Your onsite interview at Larkfield on Tuesday", "Hi Sam,\n\nWe're looking forward to hosting you on Tuesday, November 17. Your interviews start at 10:00am; please check in at the front desk about ten minutes early and bring a photo ID. Lunch with the team is included, and you'll be done by 3:00pm.\n\nSee you soon,\nThe Larkfield Team"],
  // Round 5, F1: an offer that went to someone else, or was taken back, is a no.
  ["round5 F1 offer the position to another candidate", "rejection", "Tidewell", tw, "Update", "Thank you for interviewing. We have decided to offer the position to another candidate."],
  ["round5 F1 offer to someone else", "rejection", "Tidewell", tw, "Following up", "Thanks for your time at the final round. We ended up making an offer to someone else for this role."],
  ["round5 F1 rescinded offer", "rejection", "Tidewell", tw, "Update on your offer", "We regret that we have to rescind your offer for the Data Engineer position due to a hiring freeze."],
  // F2: plural, unqualified "candidates".
  ["round5 F2 decided to move forward with candidates", "rejection", "Tidewell", tw, "Your Tidewell application", "After careful review, we have decided to move forward with candidates whose experience better fits the team."],
  ["round5 F2 moving forward with candidates who more closely match", "rejection", "Tidewell", tw, "Your Tidewell application", "We are moving forward with candidates who more closely match the needs of the role."],
  ["round5 F2 candidates who complete stays applied", "applied", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application. We move forward with candidates who complete the short questionnaire."],
  // F3: the company's own mailbox keeps a longer company name whole.
  ["round5 F3 longer name at a short domain", "interview", "Halden Robotics", "Halden Robotics Careers <careers@halden.example>", "Interview invitation", "We would like to invite you to an interview for the Robotics Engineer role."],
  ["round5 F3 mailbox named by its address", "interview", "Tidewell", "Tidewell Sourcing <sourcing@tidewell.example>", "Your final round", "Looking forward to your final round on Thursday."],
  ["round5 F3 one -ing word from a hiring address", "interview", "Quillpoint", "Quillpoint Sourcing <scheduling@quillpoint.example>", "Action required: schedule your virtual onsite with Quillpoint", "We'd like to invite you to a virtual onsite for the Product Engineer position. Please select your availability using the link below."],
  ["round5 F3 a firm whose name ends in -ing", "applied", "Acme Consulting", "Acme Consulting <hello@acmeconsulting.example>", "Thanks for applying to Acme Consulting", "We received your application."],
  // F5: a person at a hiring tool's no-reply whose signature restates their name.
  ["round5 F5 greenhouse person, full-name signature", "interview", "Tidewell", "Priya Shah <no-reply@us.greenhouse-mail.io>", "Next steps with Tidewell", "Hi Sam, the team would like to move you to the onsite interviews. Please share your availability.\n\nBest,\nPriya Shah\nTalent Partner, Tidewell"],
  ["round5 F5 greenhouse person, bare signature", "interview", "Tidewell", "Priya Shah <no-reply@us.greenhouse-mail.io>", "Next steps with Tidewell", "Hi Sam, the team would like to move you to the onsite interviews. Please share your availability.\n\nPriya Shah\nTalent Partner, Tidewell"],
  // F6: more ways an offer arrives, and ways "your offer" is not one.
  ["round5 F6 offer for the role", "offer", "Tidewell", tw, "Good news", "Here is the offer for the Data Engineer position we talked about. Let me know what you think."],
  ["round5 F6 sign your offer", "offer", "Tidewell", tw, "Next steps", "Please sign your offer by Friday so we can start your onboarding."],
  ["round5 F6 docusign envelope", "offer", "Tidewell", tw, "Please DocuSign: Tidewell offer", "Your documents are ready to sign. Review the offer and complete the envelope by November 20."],
  ["round5 F6 newsletter, negotiate your offer", "other", "", "The Early Shift <hello@theearlyshift.example>", "How to negotiate your offer", "Compare base salary, equity and the start date before you sign anything."],
  ["round5 F6 friend congratulates you", "other", "", "Jordan Lee <jordan.lee@gmail.example>", "congrats!!", "Heard about your offer, so happy for you. Drinks this week?"],
  // F7: "Name from Company" and "Name at Company" displays.
  ["round5 F7 name at company display", "screen", "Brindle Labs", "Lena at Brindle Labs <lena@brindlelabs.example>", "Phone screen", "Can we set up a phone screen this week?"],
  // F8: more hiring tools.
  ["round5 F8 coderpad test", "assessment", "Larkfield", "CoderPad <no-reply@coderpad.io>", "Larkfield has invited you to a coding test", "Larkfield has invited you to take a coding test. Please complete it within 5 days."],
  ["round5 F8 karat interview", "interview", "Larkfield", "Karat <no-reply@karat.com>", "Schedule your technical interview for Larkfield", "Please schedule your technical interview with a Karat interview engineer on behalf of Larkfield."],
  // F9: moving the reader past a stage is a no; moving a meeting is not.
  ["round5 F9 can't move you past the phone screen", "rejection", "Tidewell", tw, "Update on the Data Engineer role", "Hi Sam, thanks for your time. Unfortunately, we can't move you past the phone screen stage for this role."],
  ["round5 F9 won't be able to move you forward", "rejection", "Tidewell", tw, "Following up", "Thank you for interviewing. We won't be able to move you forward in the process."],
  ["round5 F9 move our phone screen to Friday", "screen", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Moving our call", "Hi Sam, unfortunately I need to move our phone screen for the Data role to Friday."],
  ["round5 F9 can't wait to move you forward", "interview", "Tidewell", "Priya Shah <priya@tidewell.example>", "Next round", "We can't wait to move you forward to the onsite interviews. Please share your availability."],
  // F10: an ask to take the assessment now beats a confirmation subject; a maybe does not.
  ["round5 F10 we'd like you to complete, link on its own line", "assessment", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We received your application. As a next step, we'd like you to complete our online assessment.\nhttps://assess.tidewell.example/start"],
  ["round5 F10 invite you to complete, then click", "assessment", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell!", "Hi Sam,\n\nThanks for applying to the Software Engineer Intern role. As the next step in our process, we invite you to complete a 60-minute coding assessment on HackerRank. Click the link below to begin.\n\nhttps://www.hackerrank.com/test/demo\n\nTidewell University Programs"],
  ["round5 F10 you've been invited", "assessment", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application. You've been invited to take our online assessment."],
  ["round5 F10 if a match, we'll send one", "applied", "Tidewell", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We received your application. If your profile is a match, we'll send you an online assessment within two weeks."],
  ["round5 F10 once we review, we'll send one", "applied", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application. Once we review it, we will send you a coding assessment within a week."],
  ["round5 F10 invited to a community", "applied", "Tidewell", "Tidewell <no-reply@hire.lever.co>", "Thanks for applying to Tidewell", "We received your application. You have been invited to join our talent community."],
  // F11: onsite logistics with no role named; tips and classes about "your onsite" stay other.
  ["round5 F11 onsite confirmation from a company no-reply", "interview", "Tidewell", "Tidewell <no-reply@tidewell.example>", "Your onsite on Thursday", "Your onsite starts at 9:30am at 400 Pine St. Ask for Priya at the front desk."],
  ["round5 F11 onsite tips newsletter", "other", "", "Prepwell <team@prepwell.example>", "Ace your onsite", "Five ways to stand out in your onsite interviews."],
  ["round5 F11 onsite class newsletter", "other", "", "Prepwell <team@prepwell.example>", "Live class", "Join our live class on acing your onsite interviews, Thursday at 6pm."],
  // Final batch, item 1: "your offer" from a shop, a newsletter, a friend or a realtor is not an offer.
  ["final1 card promo, your offer details", "other", "", "Lumen Card <offers@lumencard.example>", "Sam, you're pre-approved", "Your offer details are inside. Sign in to accept your 0% intro APR."],
  ["final1 retail promo, sign in", "other", "", "Fernway Outfitters <deals@fernway.example>", "Your offer ends tonight", "Your offer of 20% off ends at midnight. Sign in to redeem."],
  ["final1 salary newsletter, stacks up", "other", "", "Paygrid Weekly <weekly@paygrid.example>", "Is your offer competitive?", "This week on Paygrid: new grad software engineer offers rose 4 percent year over year.\n\nBefore you sign, see how your offer stacks up against 12,000 verified data points for your role and city.\n\nCompare now: https://paygrid.example/compare\n\nYou are receiving this because you subscribed. Unsubscribe."],
  ["final1 salary newsletter, short", "other", "", "Paygrid Weekly <weekly@paygrid.example>", "Is your offer competitive?", "Before you sign, see how your offer stacks up for your role and city."],
  ["final1 salary newsletter, how does it compare", "other", "", "Paygrid Weekly <weekly@paygrid.example>", "How does your offer compare?", "See salary bands for your role."],
  ["final1 thanks for sharing your offer deadline", "interview", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Re: timeline", "Thanks for sharing your offer deadline. We'll try to speed up the final round for the role."],
  ["final1 friend asks how your offer went", "other", "", "Jordan Lee <jordan.lee@gmail.example>", "hey", "How did your offer from Tidewell go? Did they move the start date?"],
  ["final1 docusign lease with a special offer", "other", "", "DocuSign <dse@docusign.example>", "Please DocuSign: Lease renewal", "Your landlord sent you a document to sign. Special offer: renew early and save."],
  ["final1 realtor, sellers accepted your offer", "other", "", "Ines Carvalho <ines@harthomes.example>", "Your offer on 12 Elm", "The sellers accepted your offer! Please sign the purchase agreement by Friday."],
  ["final1 congrats on your offer, then a no", "rejection", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Re: timeline", "Congrats on your offer! Unfortunately we can't move faster for this role, so we'll withdraw for now."],
  ["final1 career coach promo", "other", "", "Coachwell <hello@coachwell.example>", "Got an offer?", "Book a session and we'll help you review your offer and the role before your deadline."],
  // Item 2: pushing or moving a meeting back, up or out is a reschedule, not a no.
  ["final2 unfortunately push back our phone screen", "screen", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Moving our call", "Hi Sam, unfortunately something came up and I need to push back our phone screen for the Data Analyst role to Thursday."],
  ["final2 unfortunately push back your interview", "interview", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Schedule change", "Unfortunately our hiring manager is traveling, so we need to push back your interview for the role to next week."],
  ["final2 unfortunately move back your interview", "interview", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Schedule", "Unfortunately we need to move back your interview for the position by a day."],
  ["final2 unfortunately move up our call", "screen", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Schedule", "Unfortunately I have a conflict on Friday. Could we move up our phone screen for the role to Thursday?"],
  // Item 3: an offer whose recipient is not the reader is a no; a hedged "may ... another candidate" inside an offer is not.
  ["final3 extend an offer to a candidate whose", "rejection", "Tallowlabs", "Imogen Pryce <imogen@tallowlabs.example>", "Your final round at Tallow Labs", "Hi Sam,\n\nThank you so much for spending the afternoon with us on Friday. Everyone enjoyed meeting you, and it was a really close decision. In the end, we've decided to extend an offer to a candidate whose experience more closely matches what we need right now.\n\nI'd genuinely like to keep in touch for future roles.\n\nBest,\nImogen"],
  ["final3 extend an offer to a candidate, short", "rejection", "", "Imogen Pryce <imogen@tallowlabs.example>", "Update", "We've decided to extend an offer to a candidate whose experience more closely matches the role."],
  ["final3 offered the role to someone else", "rejection", "", "Imogen Pryce <imogen@tallowlabs.example>", "Update", "Thanks for your patience. We've offered the role to someone else."],
  ["final3 offered to and accepted by another candidate", "rejection", "Tidewell", tw, "Update on the Data Engineer role", "We wanted to let you know the position has been offered to and accepted by another candidate."],
  ["final3 extended an offer to a candidate, accepted", "rejection", "", "Imogen Pryce <imogen@tallowlabs.example>", "Update", "We extended an offer to a candidate earlier this week and they have accepted."],
  ["final3 decided to offer the role to a candidate", "rejection", "", "Imogen Pryce <imogen@tallowlabs.example>", "Update", "After a lot of discussion, we decided to offer the role to a candidate with more industry experience."],
  ["final3 another candidate accepted our offer", "rejection", "", "Imogen Pryce <imogen@tallowlabs.example>", "Update", "Another candidate has accepted our offer for the position, so we are closing the search."],
  ["final3 offer with an if-we-don't-hear-back clause", "offer", "", "Imogen Pryce <imogen@tallowlabs.example>", "Your offer", "We are pleased to offer you the Analyst role. If we don't hear back by Friday, we may extend the offer to another candidate."],
  ["final3 offer with an otherwise clause", "offer", "Tidewell", tw, "Your offer", "We are pleased to offer you the Data Engineer position. Please reply by Friday; otherwise we may extend the offer to another candidate."],
  // Item 4: a call or chat about the role from a hiring sender is a screen.
  ["final4 recruiter asks for a 30-minute call", "screen", "Kestrelbay", "Tomasz Wren <tomasz.wren@kestrelbay.example>", "Associate Product Manager role at Kestrel Bay", "Hi Sam,\n\nI'm a technical recruiter at Kestrel Bay and I came across your application for our Associate Product Manager role. Your capstone on transit data really stood out.\n\nI'd love to set up a 30-minute call to learn more about your background and walk you through the team. Are you free Thursday or Friday afternoon?\n\nBest,\nTomasz"],
  ["final4 a quick chat", "screen", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Your application", "Hi Sam, thanks for applying to the Data Analyst role. Would you be open to a quick chat this week?"],
  ["final4 a call about the role", "screen", "Tidewell", tw, "Data Analyst", "Hi Sam, do you have 20 minutes this week for a call about the Data Analyst role?"],
  ["final4 a friend's quick chat stays other", "other", "", "Jordan Lee <jordan.lee@gmail.example>", "that job", "Want to hop on a quick chat about the role I mentioned at my company?"],
  ["final4 a maybe-call under a plain subject stays applied", "applied", "Tidewell", tw, "Your Tidewell application", "We received your application. If your background is a match, we'll set up a quick chat about the role."],
  // Item 5: common offer openings.
  ["final5 offer details in the attached letter", "offer", "Orrinhealth", "Dana Whitlock <dana.whitlock@orrinhealth.example>", "Welcome to Orrin Health!", "Hi Sam,\n\nOn behalf of the whole team, I'm thrilled to let you know that we'd love for you to join Orrin Health as a Software Engineer! You'll find the full offer details in the attached letter, including salary, equity, benefits and a proposed start date of January 11.\n\nPlease let us know your decision by Wednesday, November 18. I'm happy to hop on a call to walk through anything.\n\nWarmly,\nDana"],
  ["final5 offer details, short", "offer", "", "Imogen Pryce <imogen@tallowlabs.example>", "Welcome!", "We'd love for you to join as a Software Engineer! You'll find the full offer details in the attached letter, including salary and start date."],
  ["final5 make you an offer", "offer", "", "Imogen Pryce <imogen@tallowlabs.example>", "Great news", "I'm excited to share that the team would like to make you an offer! Do you have time for a call today to go over the details?"],
  ["final5 we'd like to offer you", "offer", "", "Imogen Pryce <imogen@tallowlabs.example>", "Great news", "We'd like to offer you the position of Data Analyst."],
  ["final5 excited to offer you", "offer", "Tidewell", tw, "Great news", "We're excited to offer you the Data Engineer role on the platform team."],
  ["final5 thrilled to offer you", "offer", "Tidewell", "Nadia Okafor <nadia@tidewell.example>", "Great news", "I'm thrilled to offer you a position on the analytics team."],
  ["final5 delighted to offer you", "offer", "Tidewell", tw, "Your Tidewell offer", "We are delighted to offer you the Software Engineer Intern position for summer 2027."],
  ["final5 offer you an interview is an interview", "interview", "Tidewell", tw, "Next steps", "We'd like to offer you an interview for the Data Analyst role. Please share your availability."],
  ["final5 a shop excited to offer you early access", "other", "", "Lumen Notes <team@lumennotes.example>", "You're in", "We're excited to offer you early access to Focus Mode."],
  ["final5 pleased to offer you an interview is an interview", "interview", "Tidewell", tw, "Next steps", "We are pleased to offer you an interview for the Analyst position."],
  ["final5 would like to offer you a phone screen is a screen", "screen", "Tidewell", tw, "Next steps", "We would like to offer you a 30-minute phone screen for the Data Analyst role."],
  ["final5 a salesperson's free trial stays other", "other", "", "Kara Lunde <kara@brightdesk.example>", "A gift", "I'm happy to offer you a free 30-day trial of Brightdesk."],
  ["final3 an offer open to the first applicants stays other", "other", "", "Codecraft Bootcamp <hello@codecraft.example>", "Scholarships", "This offer applies to the first 100 applicants who enroll."],
  // Item 6: a company name with an ampersand.
  ["final6 ashby person, company with an ampersand", "interview", "Harbor & Pine", "Juno Park <no-reply@ashbyhq.com>", "Interview availability for Software Engineer, Payments at Harbor & Pine", "Hi Sam,\n\nCongratulations on moving forward to the next round! We'd like to schedule a 45 minute virtual interview with our engineering manager, Wes.\n\nPlease use the link below to share your availability for next week, and I'll send over a calendar invite once it's confirmed.\n\nThanks!\nJuno Park | Talent Partner, Harbor & Pine"],
  // Final wave: two everyday phrasings the end-of-build probe missed.
  ["wave not able to move forward at this time", "rejection", "Tidewell", tw, "Your Tidewell application", "Hi Sam,\n\nThank you for your time. We're not able to move forward at this time, but we wish you well in your search.\n\nBest,\nTidewell Careers"],
  ["wave unable to proceed at this time", "rejection", "Tidewell", tw, "Update", "Hi Sam, after the final round we are unable to proceed at this time. Thank you for interviewing with us."],
  ["wave take-home subject from a person, no application words", "assessment", "Quillpoint", "Ravi Anand <ravi@quillpoint.example>", "Take-home exercise", "Hi Sam,\n\nThanks for the chat yesterday. Next up is for you to complete a short take-home. Please return it within 5 days.\n\nRavi"],
  ["wave newsletter about take-homes stays other", "other", "", "Craft Notes <news@notes.example>", "Take-home exercises that candidates like", "Ten ways to design a fair take-home. Unsubscribe any time."],
  ["batchD re: take-home reply inviting a final-round interview is an interview", "interview", "Quillpoint", "Ravi Anand <ravi@quillpoint.example>", "Re: Take-home exercise", "Hi Sam,\n\nThanks for sending the take-home back, the team liked it. We'd like to invite you to a final-round interview with our engineering lead. Please share your availability for next week.\n\nRavi"],
  ["batchD re: coding challenge reply asking for a phone screen is a screen", "screen", "Quillpoint", "Ravi Anand <ravi@quillpoint.example>", "Re: Coding challenge", "Hi Sam,\n\nThanks for the submission. Could we set up a 30-minute phone screen to talk it through?\n\nRavi"],
  ["batchD an outage note with at this time stays other", "other", "", "Statuspage <notices@statuspage.example>", "Incident update", "Deployments are unable to continue at this time. Our engineers are investigating and will post another update within the hour."],
  ["batchD a reschedule with at this time is an interview", "interview", "Tidewell", tw, "Your Tidewell interview", "Hi Sam, we are unable to proceed at this time with Thursday's slot for the role. Could we move your interview to Friday at 2pm instead?"],
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
      mail("c", "Priya Shah <priya@acme.example>", "Next steps", "Can we set up a phone screen this week?", "2026-10-10T10:00:00.000Z"),
      mail("d", "HackerRank <no-reply@hackerrank.com>", "Acme | Online test invitation", "You have been invited by Acme to attempt an online coding test.", "2026-10-12T10:00:00.000Z"),
    ].map(classifyEmail);
    const rows = buildPipeline(events, "2026-11-01").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Acme");
  });

  it("keeps a three email interview sequence on the jobs lane", () => {
    const events = [
      mail("a", "Acme Careers <careers@acme.example>", "Thanks for applying for the Product Engineer role at Acme", "We received your application.", "2026-10-01T10:00:00.000Z"),
      mail("b", "Acme Talent <talent@acme.example>", "Interview with Acme", "We would like to invite you to interview with our co-founder.", "2026-10-10T10:00:00.000Z"),
      mail("c", "Priya Shah <priya@acme.example>", "Your onsite", "Looking forward to your final round interview.", "2026-10-15T10:00:00.000Z"),
    ].map(classifyEmail);
    const rows = buildPipeline(events, "2026-11-07").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].furthest).toBe("interview");
    expect(rows[0].lane).toBe("jobs");
  });

  it("folds a person writing through a hiring tool into the company's row", () => {
    const events = [
      mail("a", "Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We received your application.", "2026-10-01T10:00:00.000Z"),
      mail("b", "Priya Shah <no-reply@us.greenhouse-mail.io>", "Next steps with Tidewell", "The team would like to move you to the onsite interviews. Please share your availability.", "2026-10-09T10:00:00.000Z"),
      mail("c", "Tidewell Scheduling <scheduling@tidewell.example>", "Your onsite", "Here is your onsite schedule. Please confirm your availability.", "2026-10-11T10:00:00.000Z"),
    ].map(classifyEmail);
    const rows = buildPipeline(events, "2026-11-01").rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Tidewell");
    expect(rows[0].furthest).toBe("interview");
  });

  const SEQUENCES: Array<[string, string, string, Array<[string, string, string]>]> = [
    ["a hosted confirmation and the company's own mailbox at a shorter domain", "Halden Robotics", "interview", [
      ["Halden Robotics <no-reply@hire.lever.co>", "Thank you for applying to Halden Robotics", "We received your application."],
      ["Halden Robotics Careers <careers@halden.example>", "Interview invitation", "We would like to invite you to an interview for the Robotics Engineer role."],
    ]],
    ["a hosted confirmation and a mailbox named by its address", "Tidewell", "interview", [
      ["Tidewell <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Tidewell", "We received your application."],
      ["Tidewell Sourcing <sourcing@tidewell.example>", "Your final round", "Looking forward to your final round on Thursday."],
    ]],
    ["a hosted confirmation and a Name at Company sender", "Brindle Labs", "screen", [
      ["Brindle Labs <no-reply@us.greenhouse-mail.io>", "Thank you for applying to Brindle Labs", "We received your application."],
      ["Lena at Brindle Labs <lena@brindlelabs.example>", "Phone screen", "Can we set up a phone screen this week?"],
    ]],
    ["a hosted confirmation and a person at the short domain", "Halden Robotics", "screen", [
      ["Halden Robotics <no-reply@hire.lever.co>", "Thanks for applying to Halden Robotics", "We received your application."],
      ["Marco Bellini <marco@halden.example>", "Phone screen", "Can we set up a phone screen?"],
    ]],
  ];
  for (const [label, company, furthest, mails] of SEQUENCES) {
    it(`keeps one row for ${label}`, () => {
      const events = mails.map(([from, subject, body], index) => classifyEmail(mail(`${label}-${index}`, from, subject, body, `2026-10-0${index + 1}T10:00:00.000Z`)));
      const rows = buildPipeline(events, "2026-10-10").rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].company).toBe(company);
      expect(rows[0].furthest).toBe(furthest);
    });
  }
});
