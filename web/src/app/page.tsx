import { redirect } from "next/navigation";
import { signInDev, signInWithGoogle } from "@/app/actions";
import { auth, getProviders } from "@/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

const hasDevLogin = () => getProviders().some((p) => typeof p !== "function" && p.id === "credentials");

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <ThemeToggle className="absolute right-4 top-4" />
      <h1 className="text-4xl font-bold tracking-tight">Learn</h1>
      <p className="mt-3 text-muted-foreground">
        Interview questions, learning graphs and study notes, with your progress tracked as you go.
      </p>

      <form action={signInWithGoogle} className="mt-8">
        <Button type="submit" size="lg" className="w-full">
          Sign in with Google
        </Button>
      </form>

      {hasDevLogin() && (
        <form action={signInDev} className="mt-8 grid gap-2 rounded-lg border border-dashed border-border p-4">
          <label htmlFor="dev-email" className="text-sm font-medium">
            Dev login (local only)
          </label>
          <input
            id="dev-email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          />
          <Button type="submit" variant="outline">
            Sign in as this email
          </Button>
          {error === "dev-login" && (
            <p role="alert" className="text-sm text-destructive">
              Dev login failed. Check the email address.
            </p>
          )}
        </form>
      )}
    </main>
  );
}
