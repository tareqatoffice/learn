import { NotFoundView } from "@/components/NotFoundView";

/** Renders inside `(app)/layout` so TopBar stays for signed-in 404s. */
export default function NotFound() {
  return <NotFoundView />;
}
