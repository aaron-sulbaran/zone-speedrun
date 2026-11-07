// Made-up resumes for the five sample people. Plain text, as if pasted from a PDF.

export const MAYA_RESUME = `Maya Torres
Austin, TX | maya.torres@example.com | github.example/mayatorres

EDUCATION
University of Texas at Austin, B.S. Computer Science, expected May 2029
GPA 3.8. Coursework: Data Structures, Discrete Math, Computer Architecture, Intro to Machine Learning.
Dean's List, three semesters.

EXPERIENCE
Teaching Assistant, Data Structures, UT Austin, Aug 2026 to present
- Run two weekly lab sections for 45 students and hold office hours on linked lists, trees and Big-O.
- Wrote the autograder tests for a binary search tree project; they caught three common off-by-one bugs.

Software Intern, Rosewood Community Library (volunteer), Jun 2026 to Aug 2026
- Built a small catalog search page in Python and Flask so volunteers could look up donated books.
- Moved a spreadsheet of 2,000 titles into SQLite and added a barcode lookup that cut check-in time roughly in half.

PROJECTS
Study Buddy, Python, React
- A web app that turns lecture notes into flashcards and quizzes. About 120 classmates used it during finals.
- Added spaced repetition so cards the user misses come back sooner.

Bus Tracker, Java
- Course project that reads a public transit feed and shows the next three buses for a stop on a map.
- Wrote unit tests for the parser and handled missing data gracefully.

SKILLS
Python, Java, C, JavaScript, React, SQL, Git, Linux

ACTIVITIES
Women in Computing, outreach lead: organized a workshop for 60 high school students on building a first website.
Hackathon participant: placed second at a campus hackathon with a team of four.
Intramural ultimate frisbee.

Looking for a summer 2027 software engineering internship where I can work on a real codebase, get code review from people who care, and ship something users touch.`;

export const RAVI_RESUME = `Ravi Menon
Seattle, WA | ravi.menon@example.com | github.example/ravimenon

EDUCATION
University of Washington, B.S. Computer Science, June 2026
Focus on machine learning and natural language processing. Senior thesis on retrieval for question answering over course documents.

EXPERIENCE
Machine Learning Intern, Tidewell Health Systems, Jun 2025 to Sep 2025
- Fine-tuned a small language model to classify clinical intake notes; raised macro F1 from 0.71 to 0.83.
- Built an evaluation harness with 1,500 labeled examples so the team could compare prompts and models in minutes.
- Wrote a cost report showing that routing easy cases to a smaller model cut inference spend by about 40 percent.

Research Assistant, UW NLP Lab, Jan 2025 to Jun 2026
- Helped build a benchmark for long-document question answering; contributed 300 annotated questions.
- Ran ablations on chunk size and reranking for retrieval-augmented generation and wrote up the results for a workshop paper.

PROJECTS
Docsmith, Python, FastAPI, Postgres
- An assistant that answers questions over a company handbook, with citations back to the source paragraph.
- Added a feedback button and used the thumbs-down logs to find and fix two bad chunking bugs.

Prompt Regression Suite
- Open source tool that replays saved prompts against new model versions and flags answers that changed meaningfully. 210 stars.
- Added a plain English diff view so non-engineers on a team can review what changed before a model upgrade ships.

ACTIVITIES
Organizer of the UW Applied ML reading group, 40 regular attendees. Tutor for the introductory statistics course.

SKILLS
Python, PyTorch, Hugging Face, FastAPI, SQL, Docker, evaluation design, prompt engineering, retrieval

Looking for an applied AI team that ships models into a real product, measures whether they work, and lets a new grad own a piece end to end.`;

export const SAM_RESUME = `Sam Whitfield
Atlanta, GA | sam.whitfield@example.com | sam.example

EDUCATION
Georgia Institute of Technology, B.S. Electrical and Computer Engineering, expected May 2027
GPA 3.6. Embedded systems, signal processing, operating systems, human-computer interaction.

EXPERIENCE
Product Engineering Co-op, Brightwell Logistics, Jan 2026 to Aug 2026
- Owned the driver check-in flow in React Native; shipped redesigned onboarding that lifted completion from 61 to 78 percent.
- Talked to eleven drivers every other week and turned their complaints into a ranked backlog the team actually used.
- Cut a slow dispatch query from 4 seconds to 300 milliseconds by adding an index and rewriting a join.

Embedded Software Intern, Anvil Sensor Co., May 2025 to Aug 2025
- Wrote firmware in C for a temperature sensor board and a Python tool to flash and test units on the line.

PROJECTS
Pantry Pal, TypeScript, Next.js, Supabase
- A shared grocery list for roommates with receipt scanning. 400 weekly users on campus. Built, launched and supported solo.

Founder side project: Quietcoach
- Two friends and I tried selling a meeting notes tool to small clinics. We ran twenty customer calls, got three paid pilots and shut it down after learning the support load was too high. Wrote down what we learned.

SKILLS
TypeScript, React, Next.js, Node, Python, C, SQL, Postgres, Figma, customer interviews

LEADERSHIP
Founder of the Tech Product Club, 80 members. Mentor for first-year engineering students. Volunteer at a weekend robotics camp for middle schoolers, three summers running.

Looking for a co-op or new grad role at an early-stage company, ideally a small team where I can build the product, talk to users and wear more than one hat.`;

export const LENA_RESUME = `Lena Hartmann
Brooklyn, NY | lena.hartmann@example.com | lena.example/portfolio

SUMMARY
Product designer with two years of experience on consumer and small business tools. I work from research through prototype to shipped UI and I like pairing closely with engineers.

EXPERIENCE
Product Designer, Marigold Payments, Aug 2025 to present
- Redesigned the invoice flow for small merchants; support tickets about unpaid invoices fell by a third.
- Built and maintained a component library of 60 components in Figma with tokens that match the code.
- Ran six rounds of usability tests with five people each and presented findings to the founders.

Junior Designer, Papercut Studio, Jun 2024 to Aug 2025
- Designed marketing sites and onboarding screens for four client startups.
- Prototyped motion for a mobile app launch in Principle and handed specs to engineers.

SELECTED WORK (portfolio at lena.example/portfolio)
Pocket Ledger: a budgeting app concept, user research with twelve people, shipped as a working prototype.
Trailhead: a redesign of a local hiking guide, focused on offline use and clear map labels.
Seedling: an accessibility audit of a community garden's site, with fixes shipped. Contrast, focus order and form labels were the biggest wins, and the volunteers kept the changes after I left.

ACTIVITIES
Volunteer designer for a neighborhood food pantry, redesigning its signage and weekly flyer. Mentor at a portfolio review night for design students, twice a year.

EDUCATION
Pratt Institute, B.F.A. Communication Design, 2024

SKILLS
Figma, prototyping, design systems, user research, accessibility, HTML and CSS, basic React, motion

Looking for a product design role on a small team where design and engineering sit close, the work is shipped quickly, and my portfolio can speak for me.`;

export const DEV_RESUME = `Dev Kapoor
San Francisco, CA | dev.kapoor@example.com | github.example/devkapoor

SUMMARY
Infrastructure engineer turned founder. Six years building large scale systems, two small companies of my own, and now looking at accelerators, investors and founding roles.

EXPERIENCE
Senior Software Engineer, infrastructure, large consumer tech company, Jul 2020 to Sep 2026
- Worked on the internal deployment platform used by 4,000 engineers; helped cut median deploy time from 22 to 9 minutes.
- Led a four person team that moved 300 services to a new service mesh with no customer visible downtime.
- Wrote the on-call playbooks the whole org uses and mentored six junior engineers.
- Laid off in September 2026 in a company wide reduction.

FOUNDER WORK
Cartwheel, co-founder, 2023 to 2025
- A tool for small shops to compare shipping rates. 90 paying shops, 18,000 dollars in monthly revenue at the peak. Wound it down when a platform change removed our integration.

Ledgerlite, solo founder, 2025 to 2026
- A bookkeeping assistant for freelancers, built nights and weekends. 400 sign-ups, 35 paying, and a waitlist of agencies.

PROJECTS
Open source: a deploy rollback tool with 1,900 stars.
Wrote a weekly newsletter on infrastructure for founders, 2,300 subscribers.
Spoke twice at local meetups about running a small company on a boring, reliable stack.

SKILLS
Go, Python, TypeScript, Kubernetes, Postgres, AWS, distributed systems, pricing, selling to small businesses

EDUCATION
University of Illinois Urbana-Champaign, B.S. Computer Science, 2020

Looking for a path that fits what I have done: an accelerator, investors who back operators, or a founding engineer role at a company that needs someone who has shipped and sold.`;
