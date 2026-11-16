"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { safeNextPath, signInPath } from "@/lib/nextPath";
import { allow, clientAddress, LIMITS } from "@/lib/rateLimit";

/** Too many sign-in attempts from one address go back to the sign-in page with a notice. */
async function throttleSignIn(): Promise<void> {
  if (!(await allow(`signin:${await clientAddress()}`, LIMITS.signIn))) redirect("/?error=rate");
}

// Sign-ins land on `/`, which sends each user on by access status (the page they asked for or the
// dashboard, or the access page while pending or blocked) with a page redirect, so the address bar
// shows where they ended up. `next` rides along only when it is a same-origin path.
const afterSignIn = (formData?: FormData) => signInPath(safeNextPath(formData?.get("next")));

export async function signInWithGoogle(formData?: FormData): Promise<void> {
  await throttleSignIn();
  await signIn("google", { redirectTo: afterSignIn(formData) });
}

/** Local testing only; the "credentials" provider is registered solely when AUTH_DEV_LOGIN is on in development. */
export async function signInDev(formData: FormData): Promise<void> {
  await throttleSignIn();
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      redirectTo: afterSignIn(formData),
    });
  } catch (error) {
    // Anything else, including the redirect Auth.js throws on success, must propagate.
    if (error instanceof AuthError) redirect("/?error=dev-login");
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
