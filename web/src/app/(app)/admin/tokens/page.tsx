import { listTokens } from "@/admin/tokens";
import { TokensEditor } from "@/components/admin/TokensEditor";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "API tokens · Admin" };

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
          createdAt: formatDateTime(t.createdAt),
          lastUsedAt: t.lastUsedAt ? formatDateTime(t.lastUsedAt) : undefined,
          revokedAt: t.revokedAt ? formatDateTime(t.revokedAt) : undefined,
        }))}
      />
    </section>
  );
}
