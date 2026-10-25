"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

// Sign-ins land on `/`, which sends each user on by access status (dashboard, or the access page
// while pending or blocked) with a page redirect, so the address bar shows where they ended up.
const AFTER_SIGN_IN = "/";

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: AFTER_SIGN_IN });
}

/** Local testing only; the "credentials" provider is registered solely when AUTH_DEV_LOGIN is on in development. */
export async function signInDev(formData: FormData): Promise<void> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      redirectTo: AFTER_SIGN_IN,
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
