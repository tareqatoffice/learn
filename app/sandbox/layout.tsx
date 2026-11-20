import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Shop", template: "%s" },
  robots: { index: false, follow: false },
};

export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  return children;
}
