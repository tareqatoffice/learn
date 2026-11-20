import { listTokens } from "@/features/admin/tokens";
import { TokensEditor } from "@/features/admin/components/TokensEditor";
import { AdminPage } from "@/features/admin/components/layout";
import { connectDb } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "API tokens · Admin",
  description: "Create and revoke API tokens for the content CLI.",
  path: "/admin/tokens",
});

export default async function TokensPage() {
  await connectDb();
  const tokens = await listTokens();
  return (
    <AdminPage
      title="API tokens"
      width="narrow"
      description={
        <>
          Tokens let the <code>npm run content</code> command line list and pull content, and import it when the
          token has write access. They cannot read users or progress.
        </>
      }
    >
      <TokensEditor
        tokens={tokens.map((t) => ({
          id: t.id,
          name: t.name,
          createdAt: formatDateTime(t.createdAt),
          scope: t.scope,
          expiresAt: t.expiresAt ? formatDateTime(t.expiresAt) : undefined,
          expired: t.expired,
          lastUsedAt: t.lastUsedAt ? formatDateTime(t.lastUsedAt) : undefined,
          revokedAt: t.revokedAt ? formatDateTime(t.revokedAt) : undefined,
        }))}
      />
    </AdminPage>
  );
}
