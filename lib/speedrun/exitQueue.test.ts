import { describe, expect, it } from "vitest";
import { createExitQueue } from "./exitQueue";
import { phaseEventFor, phaseReducer, type PhaseEvent, type PhaseState } from "./phase";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("the exit queue", () => {
  it("applies an event that arrives during an exit, in order, when it ends", async () => {
    const applied: PhaseEvent[] = [];
    const queue = createExitQueue<PhaseEvent>((e) => applied.push(e));
    const exit = deferred();
    queue.offer(phaseEventFor("join", "building")!, () => exit.promise);
    queue.offer(phaseEventFor("building", "join")!, () => Promise.resolve());
    expect(applied).toEqual([]);
    exit.resolve();
    await tick();
    expect(applied).toEqual([{ type: "build" }, { type: "buildFailed" }]);
    const end = applied.reduce<PhaseState>((s, e) => phaseReducer(s, e), { phase: "join", tab: "matches", side: "candidate" });
    expect(end.phase).toBe("join");
  });

  it("starts a new exit for an offer after the drain", async () => {
    const applied: string[] = [];
    const queue = createExitQueue<string>((e) => applied.push(e));
    let exits = 0;
    const exit = () => (exits++, Promise.resolve());
    queue.offer("a", exit);
    await tick();
    queue.offer("b", exit);
    await tick();
    expect(applied).toEqual(["a", "b"]);
    expect(exits).toBe(2);
  });

  it("applies an exit-less change at once, but behind a running exit", async () => {
    const applied: string[] = [];
    const queue = createExitQueue<string>((e) => applied.push(e));
    queue.offer("now", null);
    expect(applied).toEqual(["now"]);
    const exit = deferred();
    queue.offer("a", () => exit.promise);
    queue.offer("b", null);
    expect(applied).toEqual(["now"]);
    exit.resolve();
    await tick();
    expect(applied).toEqual(["now", "a", "b"]);
  });

  it("still applies when the exit rejects", async () => {
    const applied: string[] = [];
    createExitQueue<string>((e) => applied.push(e)).offer("a", () => Promise.reject(new Error("cancelled")));
    await tick();
    expect(applied).toEqual(["a"]);
  });
});
