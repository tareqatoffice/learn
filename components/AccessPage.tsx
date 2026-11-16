import { Check, Clock, ShieldX } from "lucide-react";
import { checkAccessAction } from "@/app/access/actions";
import { signOutAction } from "@/app/actions";
import { AccessRequestForm } from "@/components/AccessRequestForm";
import { AppHeader, containerClass } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Signed in", "Admin review", "Access granted"];

export function AccessPage({
  email,
  blocked,
  blockReason,
  requestedAt,
  requestNote,
  checked,
}: {
  email: string;
  blocked: boolean;
  blockReason?: string | null;
  requestedAt?: Date | null;
  requestNote?: string | null;
  checked: boolean;
}) {
  return (
    <>
      <AppHeader>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </AppHeader>

      <main id="main" tabIndex={-1} className={cn(containerClass, "flex flex-1 items-start justify-center py-10 focus:outline-none sm:items-center")}>
        <section
          aria-labelledby="access-title"
          className="page-enter w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-11 items-center justify-center rounded-full",
              blocked ? "bg-destructive/10 text-destructive" : "bg-ring/10 text-ring",
            )}
          >
            {blocked ? <ShieldX className="size-6" /> : <Clock className="size-6" />}
          </span>

          <h1 id="access-title" className="mt-4 text-2xl font-semibold tracking-tight">
            {blocked ? "Access blocked" : "Waiting for approval"}
          </h1>

          {blocked ? (
            <div className="mt-2 grid gap-4 text-sm text-muted-foreground">
              <p>
                An admin has blocked access for <strong className="text-foreground">{email}</strong>. You
                can&apos;t open any pages or use the app with this account.
              </p>
              {blockReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-destructive">Reason given</p>
                  <p className="mt-1 whitespace-pre-line text-foreground">{blockReason}</p>
                </div>
              )}
              <p>If you think this is a mistake, contact the person who runs this site, or sign in with another account.</p>
              <form action={signOutAction}>
                <Button type="submit" variant="outline">
                  Sign in with another account
                </Button>
              </form>
            </div>
          ) : (
            <div className="mt-2 grid gap-6 text-sm">
              <p className="text-muted-foreground">
                You&apos;re signed in as <strong className="text-foreground">{email}</strong>. New accounts need
                an admin&apos;s approval before they can use Learn. Your request has been sent, and you&apos;ll get in
                as soon as it&apos;s approved.
              </p>

              <ol aria-label="Request progress" className="grid grid-cols-3 gap-2">
                {STEPS.map((step, i) => {
                  const done = i === 0;
                  const current = i === 1;
                  return (
                    <li key={step} aria-current={current ? "step" : undefined} className="grid gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 rounded-full",
                          done ? "bg-ok" : current ? "animate-pulse bg-ring motion-reduce:animate-none" : "bg-muted",
                        )}
                      />
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          done || current ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {done && <Check className="size-3 text-ok" aria-hidden />}
                        {step}
                        {done && <span className="sr-only">(done)</span>}
                        {current && <span className="sr-only">(in progress)</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {requestedAt && (
                <p className="text-xs text-muted-foreground">Requested {formatDateTime(requestedAt)}</p>
              )}

              {checked && (
                <p
                  role="status"
                  className="rounded-lg border border-border bg-muted/50 p-3 text-muted-foreground animate-in fade-in-0 slide-in-from-top-1"
                >
                  No decision yet. Your request is still with the admin; check back a little later.
                </p>
              )}

              <form action={checkAccessAction}>
                <Button type="submit">Check again</Button>
              </form>

              <div className="border-t border-border pt-6">
                <AccessRequestForm savedNote={requestNote ?? undefined} />
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
