"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MatchResult } from "@/lib/speedrun/match";
import { listItems, moveSelection } from "@/lib/speedrun/matchList";
import { motion, prefersReducedMotion, SR_EASE, STEP_EASE } from "@/lib/speedrun/motion";
import { MatchDetail } from "./MatchDetail";
import { MatchList } from "./MatchList";

const CASCADE_MS = 420;
const STAGGER_MS = 70;
const MAX_STAGGERED = 8;
// Clears the fixed site logo (top-4 plus 40 px), matching the shell's pt-20.
const LOGO_CLEARANCE = 80;
// Keep in step with the [@media(max-height:559px)_and_(orientation:landscape)] variants in shell/, phases/ and act2/.
const SHORT_LANDSCAPE = "(max-height: 559px) and (orientation: landscape)";
const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

type MatchesProps = { result: MatchResult; name: string | null; mentionedFounding?: boolean; nextLabel: string; onNext: () => void };

// Two panes from lg: the list on the left, the selected match on the right. Below lg the detail slides over the list.
export function Matches({ result, name, mentionedFounding = false, nextLabel, onNext }: MatchesProps) {
  const items = listItems(result);
  const [selectedKey, setSelectedKey] = useState<string | null>(items[0]?.key ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const closing = useRef(false);
  // Tracked, not read at event time, so the list's inert flag clears the moment the layout widens.
  const [wide, setWide] = useState(false);
  const selected = items.find((item) => item.key === selectedKey) ?? null;

  const registerRow = useCallback((key: string, node: HTMLButtonElement | null) => {
    if (node) rowRefs.current.set(key, node);
    else rowRefs.current.delete(key);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const targets = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-match-row]") ?? [])];
    const running = targets.map((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(.99)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: CASCADE_MS, delay: Math.min(i, MAX_STAGGERED) * STAGGER_MS, easing: SR_EASE, fill: "backwards" },
      ),
    );
    return () => running.forEach((animation) => animation.cancel());
  }, []);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // The close slide holds its end state; once the panel is hidden, drop it so a later widen shows the detail in place.
  useLayoutEffect(() => {
    if (!detailOpen) detailRef.current?.getAnimations().forEach((animation) => animation.cancel());
  }, [detailOpen]);

  // The slide in, and the focus move once it has started.
  useLayoutEffect(() => {
    if (!detailOpen) return;
    const panel = detailRef.current;
    // The close slide holds its end state until the panel is hidden; drop it so the next open starts clean.
    panel?.getAnimations().forEach((animation) => animation.cancel());
    // Short landscape: the page itself scrolls. Measure before the slide starts (the panel is shifted a full width right
    // once it runs) and move the window vertically only, so the page never travels sideways.
    const rectTop = panel?.getBoundingClientRect().top ?? 0;
    if (rectTop < LOGO_CLEARANCE && panel && !isDesktop() && window.matchMedia(SHORT_LANDSCAPE).matches) window.scrollBy({ top: rectTop - LOGO_CLEARANCE, behavior: "instant" });
    if (panel && !prefersReducedMotion()) {
      panel.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: motion().stepMs, easing: STEP_EASE });
    }
    if (panel) {
      // A hidden scroller keeps its offset in Blink and gets it back on show, so a reopen would land mid-card.
      panel.scrollTop = 0;
      panel.querySelector<HTMLElement>("[data-detail-heading]")?.focus({ preventScroll: true });
    }
  }, [detailOpen]);

  const select = (key: string) => {
    setSelectedKey(key);
    // Safari does not focus a button on mouse click; focus the row so the arrow keys work in every engine.
    rowRefs.current.get(key)?.focus({ preventScroll: true });
    if (!isDesktop()) setDetailOpen(true);
  };

  const move = (direction: "up" | "down", fromRow: boolean) => {
    if (!fromRow) return void (selectedKey && rowRefs.current.get(selectedKey)?.focus());
    const next = moveSelection(items, selectedKey, direction);
    if (next === null) return;
    setSelectedKey(next);
    rowRefs.current.get(next)?.focus({ preventScroll: false });
  };

  const closeDetail = () => {
    const panel = detailRef.current;
    if (isDesktop() || !detailOpen || closing.current) return;
    // The list is inert while the detail is open; free it first or the focus call is ignored.
    if (listRef.current) listRef.current.inert = false;
    if (selectedKey) rowRefs.current.get(selectedKey)?.focus();
    const done = () => {
      closing.current = false;
      setDetailOpen(false);
    };
    if (!panel || prefersReducedMotion()) return done();
    closing.current = true;
    const slide = panel.animate([{ transform: "translateX(0)" }, { transform: "translateX(100%)" }], { duration: motion().stepMs, easing: STEP_EASE, fill: "forwards" });
    slide.finished.then(done, done);
  };

  return (
    <section data-matches="" aria-labelledby="sr-matches-heading" className="relative mx-auto h-full w-full max-w-5xl max-lg:overflow-x-clip lg:flex lg:gap-6">
      <MatchList
        ref={listRef}
        items={items}
        selectedKey={selectedKey}
        name={name}
        matchCount={result.matches.length}
        mentionedFounding={mentionedFounding}
        onSelect={select}
        onMove={move}
        registerRow={registerRow}
        inert={!wide && detailOpen}
        nextLabel={nextLabel}
        onNext={onNext}
      />
      <MatchDetail ref={detailRef} item={selected} routes={result.routes} mentionedFounding={mentionedFounding} open={detailOpen} onClose={closeDetail} />
    </section>
  );
}
