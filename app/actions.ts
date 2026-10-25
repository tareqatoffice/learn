"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

/** Local testing only; the "credentials" provider is registered solely when AUTH_DEV_LOGIN is on in development. */
export async function signInDev(formData: FormData): Promise<void> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      redirectTo: "/dashboard",
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
