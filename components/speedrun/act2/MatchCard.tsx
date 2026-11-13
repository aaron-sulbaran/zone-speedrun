"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { speedrunCopy } from "@/lib/content";
import { cleanUrl } from "@/lib/speedrun/cleanUrl";
import { slotLocked, type IntroSlot } from "@/lib/speedrun/introSlot";
import type { Match } from "@/lib/speedrun/match";
import { BringForwardToggle, FILLED, IntroButton, IntroNote, SECONDARY } from "./IntroControls";

const copy = speedrunCopy.matches;
const CHIP = "rounded-full bg-sr-hud px-2.5 py-1 font-srcond text-[11px] uppercase tracking-wider text-sr-ink2";

export function CompanyLogo({ name, logo }: { name: string; logo: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-11 w-11 shrink-0 rounded-lg border border-sr-soft bg-sr-surface object-contain p-1" />;
  }
  return (
    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sr-ink font-srcond text-lg uppercase text-sr-surface">
      {name.trim().charAt(0)}
    </span>
  );
}

export type MatchIntro = {
  slot: IntroSlot;
  /** 1-based place on the shortlist, or null when it is not brought forward. */
  rank: number | null;
  onBring: (on: boolean) => void;
  onRequest: () => void;
  onSwap: () => void;
  /** The earned door: across to the talent team's side. */
  onDoor: () => void;
  /** Switches to the Board tab, where the shortlist is reordered. */
  onBoard: () => void;
};

export function MatchCard({ match, intro }: { match: Match; intro: MatchIntro }) {
  const { company, role, reasons, connect } = match;
  const [sheet, setSheet] = useState<"follow" | null>(null);
  const sheetId = useId();
  const applyNoteId = useId();
  const followRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLParagraphElement>(null);
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !sheet) return;
    // The detail around the card closes on an Escape nobody has handled; this one is the sheet's.
    event.preventDefault();
    followRef.current?.focus({ preventScroll: true });
    setSheet(null);
  };
  // The sheet is not a live region: focus lands on it, so it is announced once.
  // Safari does not focus a button on click, so the sheet takes focus from code when it opens (its Escape needs it),
  // and a click that closes it puts focus back on the button.
  useEffect(() => {
    if (sheet) sheetRef.current?.focus({ preventScroll: true });
  }, [sheet]);
  const toggleFollow = () => {
    if (sheet === "follow") followRef.current?.focus({ preventScroll: true });
    setSheet(sheet === "follow" ? null : "follow");
  };
  // The pane has one filled action: the request when it can be made, the door once the desk has it, otherwise Apply.
  const requestReady = intro.slot.kind === "request" && intro.slot.enabled;
  const applyAvailable = connect.includes("apply") && role !== null;
  const applyFilled = !requestReady && intro.slot.kind !== "here";
  const applyClass = `${applyFilled ? FILLED : SECONDARY} no-underline`;

  return (
    <div data-match="" data-match-card="" onKeyDown={onKeyDown} className="rounded-xl border border-sr-soft bg-sr-surface p-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0">
      <div className="flex items-center gap-3">
        <CompanyLogo name={company.name} logo={company.logo} />
        <div className="min-w-0">
          <h3 data-detail-heading="" tabIndex={-1} className="break-words text-lg font-semibold leading-tight focus:outline-none">
            {company.name}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {company.cohort && <span className={CHIP}>{company.cohort}</span>}
            {company.stage && <span className={CHIP}>{company.stage}</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {role ? (
          <>
            <p className="font-semibold">{role.title}</p>
            <span className="rounded-full bg-sr-ink px-2.5 py-1 font-srcond text-[11px] uppercase tracking-wider text-sr-surface">{copy.realRole}</span>
          </>
        ) : (
          <span className={CHIP}>{copy.companyOnly}</span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-sr-ink2">
        {reasons.map((reason) => (
          <li key={reason.text}>{reason.text}</li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <IntroButton slot={intro.slot} onRequest={intro.onRequest} onSwap={intro.onSwap} />
        {connect.includes("apply") && role && (
          <>
            <a href={cleanUrl(role.url)} target="_blank" rel="noopener noreferrer" aria-describedby={applyNoteId} data-weight={applyFilled ? "filled" : "secondary"} className={applyClass}>
              {copy.connect.apply}
              <ArrowUpRight aria-hidden="true" size={13} />
            </a>
            <span id={applyNoteId} hidden>
              {copy.connectSheet.apply}
            </span>
          </>
        )}
        {connect.includes("follow") && (
          <button ref={followRef} type="button" aria-expanded={sheet === "follow"} aria-controls={sheetId} onClick={toggleFollow} className={SECONDARY}>
            {copy.connect.follow}
          </button>
        )}
        <BringForwardToggle rank={intro.rank} onChange={intro.onBring} filled={!requestReady && !applyAvailable} locked={slotLocked(intro.slot)} />
      </div>
      <IntroNote slot={intro.slot} onDoor={intro.onDoor} onBoard={intro.onBoard} />
      <div id={sheetId}>
        {sheet && (
          <p ref={sheetRef} tabIndex={-1} data-connect-sheet={sheet} className="mt-3 rounded-lg bg-sr-bg px-4 py-3 text-sm text-sr-ink2 focus:outline-none">
            {copy.connectSheet[sheet]}
          </p>
        )}
      </div>
    </div>
  );
}
