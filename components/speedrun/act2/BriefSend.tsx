"use client";

import { useState } from "react";
import { speedrunCopy } from "@/lib/content";
import { briefRequestBody } from "@/lib/speedrun/requests";
import type { PersonKey } from "@/lib/speedrun/types";

const copy = speedrunCopy.brief;
type Status = "idle" | "sending" | "sent" | "failed" | "slow";

// One confirmation for every accepted address, so the page never says whether it is on the list.
const STATUS_COPY: Record<Status, string> = {
  idle: "",
  sending: "",
  sent: copy.send.sent,
  failed: copy.send.failed,
  slow: copy.send.slowDown,
};

// With sending off there is no input at all, so no address is ever collected.
// The address lives in this field until the request goes out, then is cleared.
export function BriefSend({ live, personKey, connected, roleIds }: { live: boolean; personKey: PersonKey | null; connected: boolean; roleIds: string[] }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  if (!live) {
    return (
      <p data-brief-off="" className="mt-6 text-sm text-sr-ink2">
        {copy.send.off}
      </p>
    );
  }
  // An uploaded visitor has no sample brief for the server to send.
  if (!personKey) {
    return (
      <p data-brief-sample-only="" className="mt-6 text-sm text-sr-ink2">
        {copy.send.sampleOnly}
      </p>
    );
  }

  const submit = async () => {
    setStatus("sending");
    try {
      const response = await fetch("/speedrun/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: briefRequestBody({ email, personKey, connected, roleIds }),
      });
      setStatus(response.ok ? "sent" : response.status === 429 ? "slow" : "failed");
      if (response.ok) setEmail("");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <form
      data-brief-send=""
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="sr-brief-email" className="text-sm font-semibold text-sr-ink">
        {copy.send.emailLabel}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id="sr-brief-email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded-full bg-sr-surface px-4 py-2.5 text-sm text-sr-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple"
        />
        <button
          type="submit"
          disabled={status === "sending" || email.trim() === ""}
          className="rounded-full bg-sr-ink px-5 py-2.5 font-srcond text-sm uppercase tracking-wider text-sr-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sr-purple disabled:opacity-40"
        >
          {copy.send.button}
        </button>
      </div>
      <p className="mt-2 text-xs text-sr-ink2">{copy.send.note}</p>
      <p data-brief-list-note="" className="mt-1 text-xs text-sr-ink2">{copy.send.listNote}</p>
      <p data-brief-status="" role="status" className="mt-2 text-sm text-sr-ink">
        {STATUS_COPY[status]}
      </p>
    </form>
  );
}
