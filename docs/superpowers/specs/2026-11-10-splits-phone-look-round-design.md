# Splits: the phone-look round (design)

On 2026-11-10 Aaron walked through PR 4 on his iPhone, and checked the desktop version too. His verdict: "a really good first attempt... I'm happy with it". This round fixes the three things he flagged in the build. His words are quoted where they set the bar.

## 1. The intake footer on phones

> "bad design around the back and build my network... I think it can just stay at the bottom of the scroll. Or whenever someone clicks it, like it can auto scroll for them to the bottom instead of having it be awkwardly cutting off text on it."

The problem: the join card's footer (Back, Continue or Build my network, the privacy line, the affiliation line) is sticky at every width. On a phone it takes about a fifth of the screen, and the cards show through its translucent fill.

**Ruling 18.**
- Below md, the footer sits in flow at the end of the card and is no longer sticky.
- Picking a choice on a step whose choices are cards (the sample people) scrolls the footer's primary button fully into view, but only if it isn't already in view. The scroll is smooth, or instant under reduced motion.
- From md up, nothing changes.
- **Why:** in-flow alone leaves the button off screen after a pick, so the build uses both of Aaron's options.
- **Cost if wrong:** one class and one effect.

The "Building your network" state keeps its disclaimer at the bottom, as Aaron said: "That's fine."

## 2. The flow chart's labels

> "the actual offer part of the Sankey chart is being covered by the final dot there... the Sankey chart is kind of clipping through the numbers, which gives it a pretty unpolished look immediately."

I measured the PR 4 build. Labels sit 7 px above their node bars, but stacked nodes are only 9 to 14 px apart, so each label runs into the bar above it.
- **At 1440:** 9 labels overlap node bars, and links run through 7.
- **At 375:** 6 labels overlap node bars, links run through 6, and "Rejected 2" collides with "Still open 1".

**Ruling 19.** In every FlowChart layout (the hero wide and narrow, the full wide and tall), three rules hold:
1. No label touches a node bar.
2. No label touches another label.
3. No link draws over label text.

The approach:
- Make room where a label sits above its node, by spacing stacked nodes or by moving the label.
- Give every label an opaque backing in the chart's halo token, so links pass under the labels.

The 84's landing target (`[data-flow-source-value]` on the Applied value) stays.

## 3. The 84 spotlight

> "As an ECE student at UT Austin, I sent in 84 applications. And all of those words should be kind of like come in... the number 84 and the word applications should kind of like flash a little bit. And the entire screen kind of goes black except for those 2 words. And then the transition happens over to the applied piece."

**Ruling 20.** The intro's sequence becomes:
1. The headline words and "I would know." play as today.
2. The subtitle comes in word by word, not as one fade.
3. **The flash:** "84 applications" pulses twice. Only opacity and scale animate.
4. **The dark:** a veil fades in over the whole viewport, with a soft cut-out around "84 applications". The words stay exactly where they are, lit through the hole, and everything else goes near-black. The caption (Ruling 21) fades in under the hole. It holds.
5. **The hand-off:** the 84 flies to Applied as today, while the veil and the caption fade out over the flight. The chart's reveal, the paragraphs and the close keep their current offsets from the 84's landing.

Rules for the beat:
- Every timing and the veil's opacity are `Motion` keys, tunable in `?tune`.
- The veil and the caption are a body-level, `aria-hidden`, `pointer-events: none` layer, which is gone at "done".
- Any input skips the beat at once.
- Reduced motion shows no flash, no veil and no caption.
- The veil's colour is a new token for both themes: near-black, never `#000`.

**Ruling 21.**
- The caption is "Some of my friends have sent 400.", a light edit of Aaron's "some of my friends have done like 400 applications".
- It's a transient emphasis on the veil. Paragraph 1 already carries the friends line, and the caption never changes the hero's layout.
- It lives in `lib/content/speedrun.ts`, and Aaron edits it.
- **Cost if wrong:** one string, or a one-line removal.

## Out of this round

- **The Board tab's content.** Aaron: "it just looks like it's a page that, that's like a Linktree for their own links". He wants to rethink it with me on desktop: brainstorm first.
- **The Why wording.** It's Aaron's; he likes its size.
- **"Built in a weekend".** It stays (Aaron: "it's pretty solid").
