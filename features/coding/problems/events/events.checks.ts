import { BehaviorSubject, Emitter, TopicBus, waitForEvent } from "./events";
import { check, eq } from "../harness";
import type { Group } from "../harness";

type Events = { ping: number };

export const events: Group = {
  slug: "events",
  title: "Events",
  level: "Intermediate",
  questions: [
    {
      name: "Emitter",
      checks: [
        eq("Passes the payload", () => {
          const seen: number[] = [];
          const bus = new Emitter<Events>();
          bus.on("ping", (n) => seen.push(n));
          bus.emit("ping", 1);
          return seen;
        }, [1]),
        eq("on returns a remover", () => {
          let calls = 0;
          const bus = new Emitter<Events>();
          const off = bus.on("ping", () => calls++);
          off();
          bus.emit("ping", 1);
          return calls;
        }, 0),
        eq("once fires one time", () => {
          let calls = 0;
          const bus = new Emitter<Events>();
          bus.once("ping", () => calls++);
          bus.emit("ping", 1);
          bus.emit("ping", 2);
          return calls;
        }, 1),
        eq("Removing during emit keeps the others", () => {
          const seen: string[] = [];
          const bus = new Emitter<Events>();
          const off = bus.on("ping", () => {
            seen.push("a");
            off();
          });
          bus.on("ping", () => seen.push("b"));
          bus.emit("ping", 1);
          return seen;
        }, ["a", "b"]),
      ],
    },
    {
      name: "waitForEvent",
      checks: [
        check("Resolves with the event", async () => {
          const target = new EventTarget();
          const promise = waitForEvent(target, "go");
          target.dispatchEvent(new Event("go"));
          return (await promise).type === "go" || "wrong event";
        }),
        check("Rejects on abort", async () => {
          const reason = new Error("stop");
          const controller = new AbortController();
          const promise = waitForEvent(new EventTarget(), "go", controller.signal);
          controller.abort(reason);
          try {
            await promise;
          } catch (err: unknown) {
            return err === reason || "wrong reason";
          }
          return "expected a rejection";
        }),
        check("Removes its listener", async () => {
          const target = new EventTarget();
          let removed = 0;
          const original = target.removeEventListener.bind(target);
          target.removeEventListener = (...args) => {
            removed++;
            original(...args);
          };
          const promise = waitForEvent(target, "go");
          target.dispatchEvent(new Event("go"));
          await promise;
          return removed > 0 || "listener left attached";
        }),
      ],
    },
    {
      name: "BehaviorSubject",
      checks: [
        eq("New subscribers get the current value", () => {
          const seen: number[] = [];
          new BehaviorSubject(1).subscribe((n) => seen.push(n));
          return seen;
        }, [1]),
        eq("next updates value and subscribers", () => {
          const seen: number[] = [];
          const subject = new BehaviorSubject(1);
          subject.subscribe((n) => seen.push(n));
          subject.next(2);
          return [seen, subject.value];
        }, [[1, 2], 2]),
        eq("Unsubscribe stops updates", () => {
          const seen: number[] = [];
          const subject = new BehaviorSubject(1);
          const stop = subject.subscribe((n) => seen.push(n));
          stop();
          subject.next(2);
          return seen;
        }, [1]),
      ],
    },
    {
      name: "TopicBus",
      checks: [
        eq("Matches exact topics", () => {
          const seen: string[] = [];
          const bus = new TopicBus();
          bus.subscribe("a.b", (t) => seen.push(t));
          bus.publish("a.b");
          bus.publish("a.c");
          return seen;
        }, ["a.b"]),
        eq("A wildcard matches one segment", () => {
          const seen: string[] = [];
          const bus = new TopicBus();
          bus.subscribe("user.*", (t) => seen.push(t));
          ["user.created", "user", "user.a.b"].forEach((t) => bus.publish(t));
          return seen;
        }, ["user.created"]),
        eq("Unsubscribe stops delivery", () => {
          let calls = 0;
          const bus = new TopicBus();
          bus.subscribe("a", () => calls++)();
          bus.publish("a");
          return calls;
        }, 0),
      ],
    },
  ],
};
