import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isAdminEmail } from "@/lib/authz";
import { User } from "@/models";

type Provider = NonNullable<NextAuthConfig["providers"]>[number];

export interface SignInProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/** Creates or updates the user document and records the login time and role. */
export async function upsertUserOnSignIn(
  profile: SignInProfile,
): Promise<{ userId: string; role: "user" | "admin" }> {
  await connectDb();
  const email = profile.email.trim().toLowerCase();
  const role = isAdminEmail(email) ? "admin" : "user";
  const fields = {
    email,
    googleId: profile.sub,
    name: profile.name,
    image: profile.picture,
    role,
    lastLoginAt: new Date(),
  };
  // Match the Google subject first, then fall back to the email (first login after a dev login).
  const doc =
    (await User.findOneAndUpdate({ googleId: profile.sub }, { $set: fields }, { returnDocument: "after" })) ??
    (await User.findOneAndUpdate({ email }, { $set: fields }, { returnDocument: "after", upsert: true }));
  return { userId: String(doc._id), role };
}

const devLoginSchema = z.object({ email: z.email() });

export function getProviders(): Provider[] {
  const env = getEnv();
  const providers: Provider[] = [
    Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }),
  ];
  // Local testing only: never available in production builds.
  if (process.env.NODE_ENV === "development" && env.AUTH_DEV_LOGIN) {
    providers.push(
      Credentials({
        id: "credentials",
        name: "Dev login",
        credentials: { email: { label: "Email", type: "email" } },
        authorize(credentials) {
          const parsed = devLoginSchema.safeParse(credentials);
          if (!parsed.success) return null;
          const email = parsed.data.email.toLowerCase();
          return { id: `dev:${email}`, email, name: email.split("@")[0] };
        },
      }),
    );
  }
  return providers;
}

// Lazy config: getEnv() must not run at import time (e.g. during `next build`).
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  providers: getProviders(),
  session: { strategy: "jwt" as const },
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account) {
        const email = (profile?.email ?? user?.email ?? token.email) as string | undefined;
        const sub =
          account.type === "credentials" ? `dev:${email?.toLowerCase()}` : profile?.sub;
        if (email && sub) {
          const { userId } = await upsertUserOnSignIn({
            sub,
            email,
            name: (profile?.name ?? user?.name ?? email) as string,
            picture: (profile?.picture ?? user?.image ?? undefined) as string | undefined,
          });
          token.userId = userId;
        }
      }
      return token;
    },
    session({ session, token }) {
      // Admin status is recomputed on every request, not stored in the 30-day JWT.
      session.user = {
        ...session.user,
        id: (token.userId as string | undefined) ?? "",
        email: token.email ?? session.user?.email ?? "",
        isAdmin: isAdminEmail(token.email),
      };
      return session;
    },
  },
}));
