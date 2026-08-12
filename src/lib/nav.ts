/** Navigation map. Shared by the sidebar, mobile bar and command palette. */

export interface NavItem {
  href: string;
  label: string;
  /** Shown in the mobile bar. */
  mobile?: boolean;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  href?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Command",
    items: [
      { href: "/", label: "Overview", mobile: true, keywords: ["home", "dashboard", "command center"] },
      { href: "/today", label: "Today", mobile: true, keywords: ["execution", "big 3", "tasks"] },
      { href: "/missions", label: "Missions", keywords: ["90 day", "mission"] },
      { href: "/goals", label: "Goals", keywords: ["vision", "targets", "objectives"] },
    ],
  },
  {
    label: "Body",
    href: "/body",
    items: [
      { href: "/body", label: "Dashboard", keywords: ["body", "fitness"] },
      { href: "/body/training", label: "Training", mobile: true, keywords: ["workout", "gym", "session"] },
      { href: "/body/strength", label: "Strength", keywords: ["lifts", "exercises", "records"] },
      { href: "/body/running", label: "Running", keywords: ["run", "pace", "intervals"] },
      { href: "/body/hyrox", label: "HYROX", keywords: ["race", "simulation", "stations"] },
      { href: "/body/nutrition", label: "Nutrition", mobile: true, keywords: ["food", "protein", "calories", "macros"] },
      { href: "/body/measurements", label: "Measurements", keywords: ["weight", "composition", "waist"] },
      { href: "/body/recovery", label: "Recovery", keywords: ["sleep", "readiness", "rest"] },
    ],
  },
  {
    label: "Business",
    href: "/business",
    items: [
      { href: "/business", label: "Dashboard", keywords: ["revenue", "mrr"] },
      { href: "/business/projects", label: "Projects", keywords: ["build", "delivery"] },
      { href: "/business/sales", label: "Sales", keywords: ["pipeline", "leads", "crm", "prospects"] },
      { href: "/business/revenue", label: "Revenue", keywords: ["customers", "income", "mrr"] },
      { href: "/business/strategy", label: "Strategy", keywords: ["offer", "target customer", "funnel"] },
    ],
  },
  {
    label: "Finance",
    href: "/finance",
    items: [
      { href: "/finance", label: "Dashboard", keywords: ["money"] },
      { href: "/finance/cash-flow", label: "Cash Flow", keywords: ["forecast", "expenses", "bills"] },
      { href: "/finance/debt", label: "Debt", keywords: ["loans", "payoff"] },
      { href: "/finance/investments", label: "Investments", keywords: ["portfolio", "etf"] },
      { href: "/finance/net-worth", label: "Net Worth", keywords: ["assets", "liabilities"] },
    ],
  },
  {
    label: "Character",
    href: "/character",
    items: [
      { href: "/character", label: "Discipline", keywords: ["promises", "reliability"] },
      { href: "/character/habits", label: "Habits", keywords: ["consistency", "streak"] },
      { href: "/character/decisions", label: "Decisions", keywords: ["firewall", "impulse", "cooling"] },
      { href: "/character/reflection", label: "Reflection", keywords: ["journal", "notes"] },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/learning", label: "Learning", keywords: ["skills", "study", "application"] },
      { href: "/ideas", label: "Ideas", keywords: ["vault", "capture"] },
      { href: "/reviews", label: "Reviews", keywords: ["weekly", "monthly", "90 day"] },
      { href: "/strategist", label: "Strategist", keywords: ["analysis", "advice", "briefing", "ai", "bottleneck"] },
      { href: "/analytics", label: "Analytics", keywords: ["trends", "trajectory", "balance"] },
      { href: "/settings", label: "Settings", keywords: ["season", "weights", "profile"] },
    ],
  },
];

export const ALL_NAV_ITEMS: Array<NavItem & { group: string }> = NAV.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.label })),
);

export const MOBILE_NAV = ALL_NAV_ITEMS.filter((i) => i.mobile);

function matches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Exactly one item is ever active: the most specific match. Without this,
 * /body/training/<id> would light up both "Dashboard" and "Training".
 */
export function activeItem(pathname: string): (NavItem & { group: string }) | undefined {
  return [...ALL_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => matches(pathname, i.href));
}

export function isActive(pathname: string, href: string): boolean {
  return activeItem(pathname)?.href === href;
}
