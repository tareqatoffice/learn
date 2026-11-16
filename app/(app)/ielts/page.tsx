import { IeltsHome } from "@/components/ielts/IeltsHome";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "IELTS",
  description: "Your IELTS study plan: countdown, today's list, plan suggestions and latest bands.",
  path: "/ielts",
});

export default async function IeltsPage() {
  return <IeltsHome />;
}
