"use client";

import { useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { readPaste } from "@/lib/speedrun/board";
import type { InboxEvent } from "@/lib/speedrun/types";
import { useAnnounce } from "./useAnnounce";

const copy = speedrunCopy.board;

// Runs entirely in the tab: the text is parsed and classified here and never sent anywhere.
export function PasteEmail({ existing, onAdd }: { existing: InboxEvent[]; onAdd: (event: InboxEvent) => void }) {
  const [text, setText] = useState("");
  const [status, announce] = useAnnounce();

  const submit = () => {
    const outcome = readPaste(text, existing);
    if (outcome.kind !== "added") {
      announce(copy.paste[outcome.kind]);
      return;
    }
    onAdd(outcome.event);
    announce(copy.paste.found(copy.kindLabels[outcome.event.kind], outcome.event.company));
    setText("");
  };

  return (
    <form
      data-paste=""
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="sr-paste" className="font-srcond text-sm uppercase tracking-widest text-sr-ink2">
        {copy.paste.label}
      </label>
      <div className="sr-prism mt-3">
        <textarea
          id="sr-paste"
          value={text}
          rows={5}
          maxLength={20_000}
          placeholder={copy.paste.placeholder}
          onChange={(e) => setText(e.target.value)}
          className="block w-full resize-y rounded-[14px] bg-sr-surface p-4 text-sm text-sr-ink placeholder:text-sr-ink2 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={text.trim() === ""}
          className="rounded-full bg-sr-ink px-5 py-2.5 font-srcond text-sm uppercase tracking-wider text-sr-surface transition-[transform,opacity] duration-200 ease-sr hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple disabled:opacity-40 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {copy.paste.button}
        </button>
        <p data-paste-status="" role="status" className="text-sm text-sr-ink">
          {status}
        </p>
      </div>
      <p className="mt-2 text-xs text-sr-ink2">{copy.paste.note}</p>
    </form>
  );
}
