"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { safeNextPath, signInPath } from "@/features/auth/lib/nextPath";
import { allow, clientAddress, LIMITS } from "@/lib/rateLimit";

async function throttleSignIn(): Promise<void> {
  if (!(await allow(`signin:${await clientAddress()}`, LIMITS.signIn))) redirect("/?error=rate");
}

const afterSignIn = (formData?: FormData) => signInPath(safeNextPath(formData?.get("next")));

export async function signInWithGoogle(formData?: FormData): Promise<void> {
  await throttleSignIn();
  await signIn("google", { redirectTo: afterSignIn(formData) });
}

export async function signInDev(formData: FormData): Promise<void> {
  await throttleSignIn();
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      redirectTo: afterSignIn(formData),
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/?error=dev-login");
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
