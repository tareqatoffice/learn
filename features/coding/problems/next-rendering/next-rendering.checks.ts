import { fetchPage, routeCheck, until, withFrame } from "../harness";
import type { Group } from "../harness";

async function firstChunk(path: string): Promise<{ ms: number; text: string }> {
  const start: number = Date.now();
  const response: Response = await fetch(path, { cache: "no-store" });
  const reader = response.body?.getReader();
  const chunk = await reader?.read();
  await reader?.cancel();
  return { ms: Date.now() - start, text: new TextDecoder().decode(chunk?.value) };
}

export const nextRendering: Group = {
  slug: "next-rendering",
  title: "Next.js Rendering",
  level: "Advanced",
  file: "app/sandbox/",
  questions: [
    {
      name: "Metadata",
      href: "/sandbox/products/1",
      spec: `Add generateMetadata to app/sandbox/products/[id]/page.tsx (see Next.js Routing, Product detail).

- The title is "<product title> | Shop"
- The description is "<category> for $<price>"
- An unknown id uses the title "Product not found"
- The root layout's metadata stays as the fallback for other pages`,
      checks: [
        routeCheck("Sets the title", () =>
          withFrame("/sandbox/products/1", async (doc) => {
            const title = await until(() => doc.title === "Phone Pro 128GB | Shop", 5000);
            return title === true || `the title is "${doc.title}"`;
          }),
        ),
        routeCheck("Sets the description", () =>
          withFrame("/sandbox/products/1", async (doc) => {
            const content = await until(() => doc.querySelector('meta[name="description"][content="Phones for $799"]'), 5000);
            return content !== null || "the description is wrong";
          }),
        ),
        routeCheck("Unknown ids get their own title", () =>
          withFrame("/sandbox/products/9999", async (doc) => {
            const title = await until(() => doc.title === "Product not found", 5000);
            return title === true || `the title is "${doc.title}"`;
          }),
        ),
      ],
    },
    {
      name: "Sitemap",
      href: "/sandbox/sitemap.xml",
      spec: `Create app/sandbox/sitemap.ts with the sitemap metadata route convention. It is served at /sandbox/sitemap.xml.

- The sitemap has one entry per product, https://shop.example/sandbox/products/<id>, plus https://shop.example/sandbox/products
- Use PRODUCTS from coding/lib/catalog.ts
(robots.ts only works at the app root, which this app already owns, so it is not part of this group.)`,
      checks: [
        routeCheck("The sitemap lists every product", async () => {
          const response = await fetch("/sandbox/sitemap.xml");
          const text = await response.text();
          const urls = text.match(/<loc>/g)?.length ?? 0;
          return (response.ok && urls === 41 && text.includes("https://shop.example/sandbox/products/40")) || `found ${urls} urls`;
        }),
      ],
    },
    {
      name: "Streaming dashboard",
      href: "/sandbox/dashboard",
      spec: `Create app/sandbox/dashboard/page.tsx.

- Render an \`h1\` "Dashboard" right away, with no waiting on data
- Below it, an async Server Component inside <Suspense> calls getProducts({}) from coding/lib/product-query.ts and shows "<totalPages> pages of products" in an element with \`data-testid="stats"\`
- The fallback shows "Loading stats…"
- getProducts takes about 800 ms: the heading must reach the browser before it finishes`,
      checks: [
        routeCheck("The slow data arrives in the stream", async () => {
          const { doc } = await fetchPage("/sandbox/dashboard");
          return doc.querySelector("[data-testid=stats]")?.textContent?.includes("4 pages of products") || "no stats";
        }),
        routeCheck("The heading arrives before the data", async () => {
          await fetch("/sandbox/dashboard"); // compile first, so only the render is timed
          const { ms, text } = await firstChunk("/sandbox/dashboard");
          return (text.includes("Dashboard") && ms < 700) || `first chunk took ${ms} ms`;
        }),
      ],
    },
    {
      name: "Parallel routes",
      href: "/sandbox/reports",
      spec: `Create /sandbox/reports with parallel routes.

- app/sandbox/reports/layout.tsx receives the \`sales\` and \`stock\` slots beside \`children\` and renders all three
- app/sandbox/reports/page.tsx renders an \`h1\` "Reports"
- app/sandbox/reports/@sales/page.tsx renders an element with \`data-testid="sales"\`
- app/sandbox/reports/@stock/page.tsx renders an element with \`data-testid="stock"\``,
      checks: [
        routeCheck("Renders the page and both slots", async () => {
          const { doc } = await fetchPage("/sandbox/reports");
          const parts = ["h1", "[data-testid=sales]", "[data-testid=stock]"].filter((part) => !doc.querySelector(part));
          return parts.length === 0 || `missing ${parts.join(", ")}`;
        }),
      ],
    },
    {
      name: "Media page",
      href: "/sandbox/media",
      spec: `Create app/sandbox/media/page.tsx.

- Render /favicon.ico with next/image, width and height 32, alt "Logo"
- Load a Client Component with next/dynamic and \`ssr: false\`. It renders "Widget ready" in an element with \`data-testid="widget"\`, and its loading option renders "Loading widget…". A \`dynamic\` call with \`ssr: false\` must itself sit in a Client Component`,
      checks: [
        routeCheck("next/image renders the Logo", async () => {
          const { doc } = await fetchPage("/sandbox/media");
          const image = doc.querySelector('img[alt="Logo"]');
          return (image?.getAttribute("width") === "32" && image.hasAttribute("data-nimg")) || "no next/image with alt Logo";
        }),
        routeCheck("The widget is left out of the server HTML", async () => {
          const { doc, text } = await fetchPage("/sandbox/media");
          return (!doc.querySelector("[data-testid=widget]") && text.includes("Loading widget…")) || "the widget rendered on the server";
        }),
        routeCheck("The widget loads in the browser", () =>
          withFrame("/sandbox/media", async (doc) => {
            const widget = await until(() => doc.querySelector("[data-testid=widget]"), 5000);
            return widget?.textContent === "Widget ready" || "the widget did not load";
          }),
        ),
      ],
    },
  ],
};
