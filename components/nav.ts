import {
  Code,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Mic,
  Network,
  NotebookText,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { TrackName } from "@/components/track";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Track hue for the icon; omitted for areas without a track. */
  track?: TrackName;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/interview", label: "Interview", icon: MessagesSquare, track: "interview" },
  { href: "/speaking", label: "Speaking", icon: Mic, track: "speaking" },
  { href: "/ielts", label: "IELTS", icon: GraduationCap, track: "ielts" },
  { href: "/graphs", label: "Graphs", icon: Network, track: "graphs" },
  { href: "/notes", label: "Notes", icon: NotebookText, track: "notes" },
  { href: "/coding", label: "Coding", icon: Code, track: "coding" },
];

/** Tabs shown in the mobile bottom bar; everything else lives under "More". */
export const TAB_HREFS = ["/dashboard", "/interview", "/speaking", "/ielts"];

export const ADMIN_ITEM: NavItem = { href: "/admin", label: "Admin", icon: Shield };
export const PROFILE_ITEM: NavItem = { href: "/profile", label: "Profile", icon: UserRound };

export const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);
