import { fetchPage, routeCheck, until, withFrame } from "../harness";
import type { Group } from "../harness";

const showsNotFound = (path: string): Promise<boolean | string> =>
  withFrame(path, async (doc) => {
    const shown = await until(() => doc.body.textContent?.includes("Product not found"), 15000);
    return shown === true || "no not-found page";
  });

export const nextRouting: Group = {
  slug: "next-routing",
  title: "Next.js Routing",
  level: "Advanced",
  file: "app/sandbox/",
  questions: [
    {
      name: "Product list",
      href: "/sandbox/products",
      spec: `Create app/sandbox/products/page.tsx, a Server Component where the URL is the only place filter state lives.

- Read \`searchParams\` (a Promise in this version of Next.js) and call getProducts from coding/lib/product-query.ts
- Support \`?q=\`, \`?category=\` and \`?page=\`, so a copied link shows the same list and the back button steps through filters
- Add a search box, a category filter (CATEGORIES from coding/lib/catalog.ts) and previous/next links
- Changing the search or category goes back to page 1
- Show each product in an \`li\` with its title, category and $price
- Bad \`page\` values (abc, 0, -3, 1.5, 999) must not crash. Fall back to a sensible page
- When nothing matches, show "No products found"`,
      checks: [
        routeCheck("Lists the first page with title, category and price", async () => {
          const { doc, text } = await fetchPage("/sandbox/products");
          const count = doc.querySelectorAll("li").length;
          return (count >= 10 && text.includes("Phone Pro 128GB") && text.includes("$799") && text.includes("Phones")) || `found ${count} rows`;
        }),
        routeCheck("Filters by q", async () => {
          const { text } = await fetchPage("/sandbox/products?q=laptop");
          return (text.includes("Laptop Air 13") && !text.includes("Phone Lite")) || "q did not filter the list";
        }),
        routeCheck("Filters by category", async () => {
          const { text } = await fetchPage("/sandbox/products?category=Audio");
          return (text.includes("Headphones Studio") && !text.includes("Phone Lite")) || "category did not filter the list";
        }),
        routeCheck("Reads the page", async () => {
          const { text } = await fetchPage("/sandbox/products?page=2");
          return (text.includes("Laptop Air 13") && !text.includes("Phone Lite")) || "page 2 is wrong";
        }),
        routeCheck("Survives bad page values", async () => {
          for (const page of ["abc", "0", "-3", "1.5", "999"]) {
            const { response } = await fetchPage(`/sandbox/products?page=${page}`);
            if (!response.ok) return `page=${page} gave status ${response.status}`;
          }
          return true;
        }),
        routeCheck("Shows an empty state", async () => {
          const { text } = await fetchPage("/sandbox/products?q=zzzz");
          return text.includes("No products found") || "no empty state";
        }),
      ],
    },
    {
      name: "Loading and error states",
      href: "/sandbox/products",
      spec: `Add the loading and error states of /sandbox/products.

- Add app/sandbox/products/loading.tsx with an element with \`data-testid="products-loading"\`
- Changing the search, category or page must show it too. Next keeps the old page on screen while only the search params change, so wrap the list in a <Suspense> whose \`key\` changes with the query, and reuse the same element as its fallback
- Add app/sandbox/products/error.tsx with a button labelled "Try again". The query \`q=fail\` makes the API reject`,
      checks: [
        routeCheck("A filter change shows the loading state", () =>
          withFrame("/sandbox/products", async (doc) => {
            await until(() => doc.querySelector("li"), 5000);
            const next = doc.querySelector<HTMLAnchorElement>('a[href*="page=2"]');
            if (!next) return "no link to page 2";
            next.click();
            const shown = await until(() => doc.querySelector("[data-testid=products-loading]"), 1500);
            return shown !== null || "no loading state after clicking next";
          }),
        ),
        routeCheck("q=fail shows the error state with a retry button", () =>
          withFrame("/sandbox/products?q=fail", async (doc) => {
            const button = await until(
              () => [...doc.querySelectorAll("button")].find((b) => b.textContent?.includes("Try again")),
              15000,
            );
            return button !== null || "no Try again button";
          }),
        ),
      ],
    },
    {
      name: "Product detail",
      href: "/sandbox/products/1",
      spec: `Create app/sandbox/products/[id]/page.tsx.

- Read the \`id\` from \`params\` (a Promise) and find the product in PRODUCTS from coding/lib/catalog.ts
- Show the title in an \`h1\`, plus the category and $price
- An unknown or non-numeric id calls notFound()
- Add app/sandbox/products/[id]/not-found.tsx that shows "Product not found"`,
      checks: [
        routeCheck("Shows the product", async () => {
          const { doc, text } = await fetchPage("/sandbox/products/12");
          return (doc.querySelector("h1")?.textContent?.includes("Laptop Pro 14") && text.includes("$1899")) || "product 12 did not render";
        }),
        routeCheck("Unknown ids show the not-found page", () => showsNotFound("/sandbox/products/9999")),
        routeCheck("Non-numeric ids show the not-found page", () => showsNotFound("/sandbox/products/abc")),
      ],
    },
    {
      name: "Shop layout",
      href: "/sandbox/products",
      spec: `Create app/sandbox/products/layout.tsx, shared by the list and detail pages.

- Render a \`nav\` with \`data-testid="shop-nav"\` above \`children\`, with a next/link to /sandbox/products
- Put the link in a small Client Component that uses usePathname and sets aria-current="page" only when the pathname is exactly /sandbox/products
- Moving between the list and a product must be a client navigation: link each product in the list to its detail page with next/link`,
      checks: [
        routeCheck("The nav is on the list and detail pages", async () => {
          const list = await fetchPage("/sandbox/products");
          const detail = await fetchPage("/sandbox/products/1");
          const onBoth = list.doc.querySelector("[data-testid=shop-nav]") && detail.doc.querySelector("[data-testid=shop-nav]");
          return onBoth !== null || "the nav is missing";
        }),
        routeCheck("aria-current follows the pathname", async () => {
          const list = await fetchPage("/sandbox/products");
          const detail = await fetchPage("/sandbox/products/1");
          const current = (doc: Document): boolean => doc.querySelector('[data-testid=shop-nav] [aria-current="page"]') !== null;
          return (current(list.doc) && !current(detail.doc)) || "aria-current is wrong";
        }),
        routeCheck("A product link navigates on the client", () =>
          withFrame("/sandbox/products", async (doc, frame) => {
            const nav = await until(() => doc.querySelector("[data-testid=shop-nav]"), 5000);
            const link = await until(() => doc.querySelector<HTMLAnchorElement>('li a[href="/sandbox/products/1"]'), 5000);
            if (!nav || !link) return "no nav, or no link to product 1";
            link.click();
            const moved = await until(() => frame.contentWindow?.location.pathname === "/sandbox/products/1", 5000);
            return (moved === true && doc.contains(nav)) || "the layout was rebuilt instead of kept";
          }),
        ),
      ],
    },
    {
      name: "Redirect",
      href: "/sandbox/deals",
      spec: `Create app/sandbox/deals/page.tsx.

- It renders nothing and calls redirect() from next/navigation to /sandbox/products?category=Accessories`,
      checks: [
        routeCheck("Lands on the filtered list", () =>
          withFrame("/sandbox/deals", async (doc, frame) => {
            const moved = await until(() => frame.contentWindow?.location.search === "?category=Accessories", 5000);
            const body = frame.contentDocument ?? doc;
            const text = await until(() => (frame.contentDocument ?? body).body.textContent?.includes("Mouse Wireless"), 5000);
            return (moved === true && text === true) || "did not land on the Accessories list";
          }),
        ),
      ],
    },
  ],
};
