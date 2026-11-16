import { BookOpen, GraduationCap, MessagesSquare, Mic, Network } from "lucide-react";
import { signInDev, signInWithGoogle } from "@/app/actions";
import { AppHeader, containerClass } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Interview",
    text: "Question books with spaced review and quick quizzes.",
  },
  {
    icon: Network,
    title: "Graphs",
    text: "Topics laid out by prerequisite, so you always know what is next.",
  },
  {
    icon: BookOpen,
    title: "Notes",
    text: "Chaptered study notes that remember where you stopped.",
  },
  {
    icon: Mic,
    title: "Speaking",
    text: "Daily shadowing, reading aloud and recorded answers, with transcripts and feedback.",
  },
  {
    icon: GraduationCap,
    title: "IELTS",
    text: "A study plan to your test date, with practice tests for all four skills.",
  },
];

export function Landing({
  error,
  next,
  hasDevLogin,
}: {
  error?: string;
  next: string | null;
  hasDevLogin: boolean;
}) {
  return (
    <>
      <AppHeader>
        <ThemeToggle className="ml-auto" />
      </AppHeader>

      <main id="main" tabIndex={-1} className={cn(containerClass, "flex flex-1 items-center py-6 focus:outline-none")}>
        <div className="page-enter w-full">
          <div className="grid items-center gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_26.25rem] lg:gap-16 lg:py-16">
            <section aria-labelledby="welcome" className="grid gap-6">
              <div>
                <h1
                  id="welcome"
                  className="text-4xl font-bold tracking-tight sm:text-5xl"
                >
                  Learn, and see it stick.
                </h1>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Interview questions, learning graphs and study notes, with
                  your progress tracked as you go.
                </p>
              </div>
              <ul className="grid gap-3 sm:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, text }) => (
                  <li
                    key={title}
                    className="group rounded-xl border border-border bg-card p-4"
                  >
                    <Icon
                      className="size-5 text-ring transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-110 motion-reduce:transition-none"
                      aria-hidden
                    />
                    <h2 className="mt-3 font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section
              aria-labelledby="sign-in"
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <h2 id="sign-in" className="text-lg font-semibold">
                Sign in
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use your Google account to pick up where you left off.
                New accounts are reviewed by an admin before they get access.
              </p>

              {error === "email-in-use" && (
                <p role="alert" className="mt-6 text-sm text-destructive">
                  This Google account&apos;s email address already belongs to another Learn account. Sign in with that account, or
                  ask the admin to merge them.
                </p>
              )}
              {error === "rate" && (
                <p role="alert" className="mt-6 text-sm text-destructive">
                  Too many sign-in attempts. Wait a few minutes and try again.
                </p>
              )}
              <form action={signInWithGoogle} className="mt-6">
                {next && <input type="hidden" name="next" value={next} />}
                <Button type="submit" size="lg" className="w-full">
                  Sign in with Google
                </Button>
              </form>

              {hasDevLogin && (
                <form
                  action={signInDev}
                  className="mt-6 grid gap-2 rounded-lg border border-dashed border-border p-4"
                >
                  {next && <input type="hidden" name="next" value={next} />}
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
                    <p
                      role="alert"
                      className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-1"
                    >
                      Dev login failed. Check the email address.
                    </p>
                  )}
                </form>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
