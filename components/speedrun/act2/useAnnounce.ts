import { useCallback, useEffect, useRef, useState } from "react";

/** Text for a polite live region. Clearing first makes the same sentence announce again. */
export function useAnnounce(): [string, (text: string) => void] {
  const [text, setText] = useState("");
  const frame = useRef(0);
  const announce = useCallback((next: string) => {
    cancelAnimationFrame(frame.current);
    setText("");
    frame.current = requestAnimationFrame(() => setText(next));
  }, []);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return [text, announce];
}
