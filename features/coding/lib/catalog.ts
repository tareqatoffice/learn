export interface Product {
  id: number;
  title: string;
  category: string;
  price: number;
}

export const CATEGORIES: readonly string[] = ["Phones", "Laptops", "Audio", "Accessories"];

export const PRODUCTS: readonly Product[] = [
  { id: 1, title: "Phone Pro 128GB", category: "Phones", price: 799 },
  { id: 2, title: "Phone Pro Max 256GB", category: "Phones", price: 999 },
  { id: 3, title: "Phone Lite", category: "Phones", price: 349 },
  { id: 4, title: "Phone Mini", category: "Phones", price: 499 },
  { id: 5, title: "Phone Fold", category: "Phones", price: 1499 },
  { id: 6, title: "Phone Rugged", category: "Phones", price: 429 },
  { id: 7, title: "Phone Camera Edition", category: "Phones", price: 899 },
  { id: 8, title: "Phone Budget", category: "Phones", price: 199 },
  { id: 9, title: "Phone Gaming", category: "Phones", price: 699 },
  { id: 10, title: "Phone Classic", category: "Phones", price: 299 },
  { id: 11, title: "Laptop Air 13", category: "Laptops", price: 1099 },
  { id: 12, title: "Laptop Pro 14", category: "Laptops", price: 1899 },
  { id: 13, title: "Laptop Pro 16", category: "Laptops", price: 2399 },
  { id: 14, title: "Laptop Student", category: "Laptops", price: 549 },
  { id: 15, title: "Laptop Gaming 15", category: "Laptops", price: 1599 },
  { id: 16, title: "Laptop Ultralight", category: "Laptops", price: 1299 },
  { id: 17, title: "Laptop Chromebook", category: "Laptops", price: 399 },
  { id: 18, title: "Laptop Workstation", category: "Laptops", price: 2999 },
  { id: 19, title: "Laptop Convertible", category: "Laptops", price: 1199 },
  { id: 20, title: "Laptop Business", category: "Laptops", price: 999 },
  { id: 21, title: "Headphones Studio", category: "Audio", price: 249 },
  { id: 22, title: "Headphones Wireless", category: "Audio", price: 179 },
  { id: 23, title: "Earbuds Sport", category: "Audio", price: 99 },
  { id: 24, title: "Earbuds Pro", category: "Audio", price: 199 },
  { id: 25, title: "Speaker Portable", category: "Audio", price: 79 },
  { id: 26, title: "Speaker Smart", category: "Audio", price: 129 },
  { id: 27, title: "Soundbar Compact", category: "Audio", price: 299 },
  { id: 28, title: "Microphone USB", category: "Audio", price: 89 },
  { id: 29, title: "Turntable Classic", category: "Audio", price: 349 },
  { id: 30, title: "Amplifier Desktop", category: "Audio", price: 159 },
  { id: 31, title: "Charger Fast 65W", category: "Accessories", price: 39 },
  { id: 32, title: "Cable USB-C 2m", category: "Accessories", price: 15 },
  { id: 33, title: "Case Phone Leather", category: "Accessories", price: 29 },
  { id: 34, title: "Stand Laptop Aluminium", category: "Accessories", price: 49 },
  { id: 35, title: "Mouse Wireless", category: "Accessories", price: 35 },
  { id: 36, title: "Keyboard Mechanical", category: "Accessories", price: 119 },
  { id: 37, title: "Webcam HD", category: "Accessories", price: 69 },
  { id: 38, title: "Hub USB-C 7-in-1", category: "Accessories", price: 59 },
  { id: 39, title: "Sleeve Laptop 14in", category: "Accessories", price: 25 },
  { id: 40, title: "Power Bank 20000mAh", category: "Accessories", price: 45 },
];

export function searchProducts(query: string, signal?: AbortSignal): Promise<Product[]> {
  return new Promise<Product[]>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const delay: number = query.length < 3 ? 1500 : 200;
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      if (query === "fail") {
        reject(new Error("Search failed"));
        return;
      }
      const needle: string = query.toLowerCase();
      resolve(PRODUCTS.filter((p) => p.title.toLowerCase().includes(needle)));
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
