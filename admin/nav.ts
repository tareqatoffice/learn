export type AdminSectionLink = { href: string; label: string; description: string };
export type AdminSectionGroup = { label: string; links: AdminSectionLink[] };

/**
 * The admin sections, in one place: the sidebar and the admin home page both read this, so a new
 * page is added here once. Content is what learners see; Users & access controls who gets in;
 * Data moves content in and out; Settings configures app features.
 */
export const ADMIN_NAV: AdminSectionGroup[] = [
  {
    label: "Content",
    links: [
      { href: "/admin/books", label: "Question books", description: "Interview questions and answers, by book and part." },
      { href: "/admin/graphs", label: "Graphs", description: "Topic graphs with prerequisites." },
      { href: "/admin/notes", label: "Note series", description: "Chaptered notes." },
      { href: "/admin/speaking", label: "Speaking lessons", description: "Shadowing audio, read-aloud passages and speaking prompts." },
      { href: "/admin/ielts/speaking", label: "IELTS Speaking", description: "Part 1 topics, Part 2 cue cards and Part 3 discussions." },
      { href: "/admin/subjects", label: "Subjects", description: "Tags that link books, graphs and notes." },
    ],
  },
  {
    label: "Users & access",
    links: [
      { href: "/admin/users", label: "Users", description: "Approve, block and review sign-ins." },
      { href: "/admin/tokens", label: "API tokens", description: "Tokens for the content command line." },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/admin/import", label: "Import markdown", description: "Preview and import content from markdown." },
      { href: "/admin/export", label: "Export", description: "Download all content as JSON." },
      { href: "/admin/revisions", label: "Revisions", description: "Earlier versions of content, to view or restore." },
    ],
  },
  {
    label: "Settings",
    links: [
      { href: "/admin/ai", label: "AI coach", description: "OpenRouter key, models and limits for the quiz coach." },
      { href: "/admin/ielts/settings", label: "IELTS settings", description: "Hours-per-band guide, plan phases and suggestion thresholds." },
    ],
  },
];
