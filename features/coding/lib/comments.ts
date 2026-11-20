export interface Comment {
  id: string;
  text: string;
}

export type CommentFormState =
  | { status: "idle" }
  | { status: "invalid"; error: string; text: string }
  | { status: "failed"; error: string; text: string };

interface CommentStore {
  comments: Comment[];
  nextId: number;
}

// Kept on globalThis so dev-mode module reloads do not wipe the data.
const globalStore = globalThis as typeof globalThis & { __commentStore?: CommentStore };
const store: CommentStore = (globalStore.__commentStore ??= {
  comments: [{ id: "c0", text: "First comment" }],
  nextId: 1,
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Provided code, not part of the test. Returns the stored comments, oldest first. */
export async function listComments(): Promise<Comment[]> {
  return [...store.comments];
}

/**
 * Provided code, not part of the test. Takes 800 ms to store a comment and
 * rejects when the text contains "fail".
 */
export async function addComment(text: string): Promise<Comment> {
  await delay(800);
  if (text.includes("fail")) {
    throw new Error("Could not save comment");
  }
  const comment: Comment = { id: `c${store.nextId++}`, text };
  store.comments.push(comment);
  return comment;
}
