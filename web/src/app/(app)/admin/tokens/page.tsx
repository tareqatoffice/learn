import { listTokens } from "@/admin/tokens";
import { TokensEditor } from "@/components/admin/TokensEditor";
import { connectDb } from "@/lib/db";

export const metadata = { title: "API tokens · Admin" };
const when = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

export default async function TokensPage() {
  await connectDb();
  const tokens = await listTokens();
  return (
    <section className="grid max-w-3xl gap-4">
      <h1 className="text-2xl font-semibold">API tokens</h1>
      <p className="text-sm text-muted-foreground">
        Tokens let the <code>npm run content</code> command line list, pull and import content. They cannot read users or progress.
      </p>
      <TokensEditor
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: when.format(t.createdAt),
          lastUsedAt: t.lastUsedAt ? when.format(t.lastUsedAt) : undefined,
          revokedAt: t.revokedAt ? when.format(t.revokedAt) : undefined,
        }))}
      />
    </section>
  );
}
