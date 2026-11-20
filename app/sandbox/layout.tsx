import type { Metadata } from "next";

// Practice routes for the Next.js coding-test groups (see /coding). Build your
// answers under app/sandbox/ and app/api/sandbox/. This layout adds no markup,
// so the checks see only what your pages render.
export const metadata: Metadata = {
  title: { default: "Shop", template: "%s" },
  robots: { index: false, follow: false },
};

export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  return children;
}
