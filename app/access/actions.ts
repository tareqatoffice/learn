"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { accessStatusFor, saveRequestNote } from "@/lib/access";
import { allow, LIMITS, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export type NoteState = { ok: boolean; message: string } | null;

export async function sendRequestNoteAction(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const session = await auth();
  const user = session?.user;
  const note = formData.get("note");
  if (!user?.id) return { ok: false, message: "Your session has ended. Sign in again to send a note." };
  if (!(await allow(`access:${user.id}`, LIMITS.access))) return { ok: false, message: RATE_LIMIT_MESSAGE };
  const result = await saveRequestNote(user.id, typeof note === "string" ? note : "");
  if (!result.ok) return { ok: false, message: result.error };
  return { ok: true, message: "Note sent. The admin will see it with your request." };
}

export async function checkAccessAction(): Promise<void> {
  const session = await auth();
  const user = session?.user;
  if (!user?.email) redirect("/");
  if (!(await allow(`access:${user.id ?? user.email}`, LIMITS.access))) redirect("/access?checked=1");
  const status = await accessStatusFor({ userId: user.id, email: user.email });
  if (status === "approved") redirect("/dashboard");
  redirect(status ? "/access?checked=1" : "/");
}
