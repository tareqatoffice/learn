"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accessStatusFor, saveRequestNote } from "@/lib/access";

export type NoteState = { ok: boolean; message: string; note?: string } | null;

/** For useActionState: saves the pending user's note and reports what happened in words. */
export async function sendRequestNoteAction(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const session = await auth();
  const user = session?.user;
  const note = formData.get("note");
  if (!user?.id) return { ok: false, message: "Your session has ended. Sign in again to send a note." };
  const result = await saveRequestNote(user.id, typeof note === "string" ? note : "");
  if (!result.ok) return { ok: false, message: result.error, note: typeof note === "string" ? note : "" };
  return { ok: true, message: "Note sent. The admin will see it with your request." };
}

/** Re-reads the status: an approved user goes straight in, anyone else back to the page with a notice. */
export async function checkAccessAction(): Promise<void> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) redirect("/");
  const status = await accessStatusFor({ userId: user.id, email: user.email });
  if (status === "approved") redirect("/dashboard");
  redirect(status ? "/access?checked=1" : "/");
}
