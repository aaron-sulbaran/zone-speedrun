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
4. **The dark:** a near-black veil fades in over the whole viewport. A lit copy of "84 applications" sits above it, at the words' exact place, so everything else goes near-black and only those words show. The caption (Ruling 21) fades in under them. It holds. (Ruling 27 replaced the first build's soft cut-out.)
5. **The hand-off:** the caption fades out at the end of the hold. The 84 flies to Applied as today while the veil lifts, and the lit copy crossfades back to the page's words. The chart's reveal, the paragraphs and the close keep their current offsets from the 84's landing.

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

## Rulings made during the build

**Ruling 22.** Safari focus fixes and a desktop WebKit e2e project under `E2E_ALL=1`, from the site lead's WebKit gate on PR 4. The connect sheet takes focus when it opens, and the paste button is focused from code. The account menu treats focus landing on an ancestor as not leaving. Tab pins press `tabKey`.

**Ruling 23.** The footer scroll applies to the people step only. ArrangementCards is multi-select, and scrolling after its first toggle would carry the other cards away. Only pointer picks scroll; arrow keys only select.

**Ruling 24.** The footer scroll targets the whole footer, not just the button, so the privacy and affiliation lines stay readable ("auto scroll for them to the bottom").

**Ruling 25.** The chart's stacked bars sit 24 apart (they were 9 in the narrow hero), so a label above a bar never reaches the bar above it. The narrow hero's bars are about 40% thinner as a result, and still read well at 375.

**Ruling 26.** Label backings are a dilated, text-hugging halo (radius 3, sRGB) in the colour of whatever sits behind the chart. Where a label crosses a ribbon this reads as a slightly lumpy highlight, but there are no square bites and no line runs through a number. Tight rectangles would need text measured on the client, and the no-JS hero would lose them. Aaron's phone look can veto this.

**Ruling 27.** The spotlight uses a full veil plus a lit copy of the words, not a cut-out. In light theme the cut-out read as a large glowing white oval that also lit "Austin, I sent" and covered half a phone screen. Aaron asked for "the entire screen kind of goes black except for those 2 words". The veil's default opacity is 0.95, so it reads black, and the caption is gone before the 84 flies, so the flight never crosses it on a phone.

**Ruling 28.** The join footer is in flow, and the pick scroll applies, on landscape phones too (`max-height: 559px` and landscape, the shell's existing condition), not only below md. The same "cutting off text" problem showed there.

**Ruling 31.** On phones (below md, or a phone held sideways, Ruling 28's definition), the 400 caption starts at the left edge of the paragraph that holds "84 applications". It's left-aligned and never wider than that paragraph. Desktop keeps it centred under the words. The caption's wrap is balanced, so at 320 "400." never sits alone on a second line. From the lead's gate (D30); Aaron: "Align it".

## Out of this round

- **The Board tab's content.** Aaron: "it just looks like it's a page that, that's like a Linktree for their own links". He wants to rethink it with me on desktop: brainstorm first.
- **The Why wording.** It's Aaron's; he likes its size.
- **"Built in a weekend".** It stays (Aaron: "it's pretty solid").
