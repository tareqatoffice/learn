import { PRODUCTS, type Product } from "./catalog";

export interface ProductQuery {
  q?: string;
  category?: string;
  page?: number;
}

export interface ProductPage {
  items: Product[];
  page: number;
  totalPages: number;
}

const PAGE_SIZE = 10;

/**
 * Provided code, not part of the test. Simulates a product API.
 * Takes 800 ms, returns 10 products per page (page is 1-based), and rejects
 * when `q`, trimmed, is "fail". A page outside the range returns empty `items`.
 */
export function getProducts(query: ProductQuery): Promise<ProductPage> {
  return new Promise<ProductPage>((resolve, reject) => {
    setTimeout(() => {
      const q: string = (query.q ?? "").trim();
      if (q === "fail") {
        reject(new Error("Product query failed"));
        return;
      }
      const needle: string = q.toLowerCase();
      const matches: Product[] = PRODUCTS.filter(
        (p) =>
          (!query.category || p.category === query.category) &&
          p.title.toLowerCase().includes(needle),
      );
      const page: number = query.page ?? 1;
      const totalPages: number = Math.ceil(matches.length / PAGE_SIZE);
      const start: number = (page - 1) * PAGE_SIZE;
      const items: Product[] =
        Number.isInteger(page) && page >= 1 ? matches.slice(start, start + PAGE_SIZE) : [];
      resolve({ items, page, totalPages });
    }, 800);
  });
}
