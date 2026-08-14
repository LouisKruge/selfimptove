/**
 * NEXUS — the AI business operating system, as an executable plan.
 *
 * Sixty tasks from defining the ideal customer through to a measured case
 * study, in thirteen phases. Every field here came from the operator: outcome,
 * expected outcome, priority, scheduled date, deadline and estimate.
 *
 * Two things were not specified and are marked where they occur:
 *   · tasks 1–8 arrived without a phase heading; they are grouped as PHASE 0
 *   · tasks 01 and 02 are both must-wins on the same day, which breaks the
 *     one-must-win-per-day rule this system enforces — see MUST_WIN_CONFLICTS
 */

export interface NexusTask {
  n: number;
  phase: string;
  title: string;
  /** The outcome, in the operator's words. */
  outcome: string;
  expected: string;
  priority: "MUST_WIN" | "SUPPORT" | "BACKLOG";
  scheduled: string;
  deadline: string;
  minutes: number;
}

export const NEXUS_PROJECT = {
  title: "NEXUS — AI Business Operating System",
  objective:
    "Build NEXUS Procurement Intelligence: an AI business operating system for South African construction, engineering and manufacturing companies that turns procurement data into proactive, quantified recommendations.",
  expectedOutcome:
    "A deployed product with a paying customer and measured ROI — money saved, time saved, visibility gained or risk reduced.",
  nextAction: "TASK 01 — Define the ICP.",
  ideaTitle: "AI Business Operating System",
};

const P0 = "PHASE 0 — MARKET VALIDATION";
const P1 = "PHASE 1 — NEXUS PRODUCT DEFINITION";
const P2 = "PHASE 2 — TECHNICAL FOUNDATION";
const P3 = "PHASE 3 — MODULE 01: COMMAND CENTER";
const P4 = "PHASE 4 — MODULE 02: PROCUREMENT";
const P5 = "PHASE 5 — MODULE 03: SUPPLIERS";
const P6 = "PHASE 6 — MODULE 04: FINANCE";
const P7 = "PHASE 7 — MODULE 05: OPERATIONS";
const P8 = "PHASE 8 — MODULE 06: INTELLIGENCE";
const P9 = "PHASE 9 — MODULE 07: AUTOMATIONS";
const P10 = "PHASE 10 — MODULE 08: AUDIT";
const P11 = "PHASE 11 — THE KILLER FEATURE";
const P12 = "PHASE 12 — REAL CUSTOMER DEPLOYMENT";
const P13 = "PHASE 13 — PROVE NEXUS WORKS";

export const NEXUS_TASKS: NexusTask[] = [
  {
    n: 1, phase: P0, title: "TASK 01 — Define the ICP",
    outcome:
      "Define the ideal first NEXUS customer as a 50–500 employee construction, engineering or manufacturing company with significant procurement complexity.",
    expected:
      "A documented ICP including company size, procurement complexity, decision-makers, systems used, purchasing volume and likely NEXUS value.",
    priority: "MUST_WIN", scheduled: "2026-08-15", deadline: "2026-08-15", minutes: 90,
  },
  {
    n: 2, phase: P0, title: "TASK 02 — Build target-company list",
    outcome:
      "Build a list of 50 South African construction, engineering and manufacturing companies matching the NEXUS ICP.",
    expected: "50 qualified companies with company information, decision-maker and contact details.",
    // Specified as a must-win, but task 01 already holds 2026-08-15. Scheduled as
    // SUPPORT so the one-must-win-per-day rule holds. See MUST_WIN_CONFLICTS.
    priority: "SUPPORT", scheduled: "2026-08-15", deadline: "2026-08-16", minutes: 180,
  },
  {
    n: 3, phase: P0, title: "TASK 03 — Identify procurement decision-makers",
    outcome:
      "Identify the procurement, operations, finance and executive decision-makers at the target companies.",
    expected: "At least 50 qualified decision-maker contacts mapped to target companies.",
    priority: "MUST_WIN", scheduled: "2026-08-16", deadline: "2026-08-17", minutes: 180,
  },
  {
    n: 4, phase: P0, title: "TASK 04 — Map procurement problems",
    outcome: "Document the most common procurement problems experienced by the target companies.",
    expected:
      "Ranked list of procurement problems involving suppliers, pricing, RFQs, approvals, POs, invoices and visibility.",
    priority: "MUST_WIN", scheduled: "2026-08-17", deadline: "2026-08-18", minutes: 180,
  },
  {
    n: 5, phase: P0, title: "TASK 05 — Interview first prospects",
    outcome:
      "Complete interviews with at least 10 procurement, finance, operations or executive decision-makers.",
    expected:
      "10 real customer conversations documenting current workflows, pain, costs, existing software and willingness to adopt a solution.",
    priority: "MUST_WIN", scheduled: "2026-08-18", deadline: "2026-08-24", minutes: 600,
  },
  {
    n: 6, phase: P0, title: "TASK 06 — Map current procurement workflow",
    outcome:
      "Map the real procurement workflow used by the target customer segment from purchase request through invoice.",
    expected:
      "A validated current-state workflow showing people, systems, documents, approvals, delays and failure points.",
    priority: "MUST_WIN", scheduled: "2026-08-24", deadline: "2026-08-25", minutes: 240,
  },
  {
    n: 7, phase: P0, title: "TASK 07 — Identify highest-value wedge",
    outcome: "Select the single procurement problem NEXUS should solve first.",
    expected: "One validated problem with clear financial or operational value.",
    priority: "MUST_WIN", scheduled: "2026-08-26", deadline: "2026-08-26", minutes: 120,
  },
  {
    n: 8, phase: P0, title: "TASK 08 — Secure design-partner candidate",
    outcome:
      "Identify at least one company willing to provide real workflow information and evaluate an early NEXUS solution.",
    expected: "At least one potential design partner willing to participate in NEXUS V1 validation.",
    priority: "MUST_WIN", scheduled: "2026-08-27", deadline: "2026-08-29", minutes: 300,
  },

  {
    n: 9, phase: P1, title: "TASK 09 — Define NEXUS V1",
    outcome: "Define the exact capabilities included in NEXUS Procurement Intelligence V1.",
    expected:
      "A locked V1 scope focused on procurement rather than attempting to build the entire NEXUS OS.",
    priority: "MUST_WIN", scheduled: "2026-08-30", deadline: "2026-08-30", minutes: 180,
  },
  {
    n: 10, phase: P1, title: "TASK 10 — Define purchase-request workflow",
    outcome: "Define the complete digital purchase-request workflow from employee request to approval.",
    expected: "Validated workflow supporting request creation, review, approval and procurement handoff.",
    priority: "MUST_WIN", scheduled: "2026-08-31", deadline: "2026-08-31", minutes: 180,
  },
  {
    n: 11, phase: P1, title: "TASK 11 — Define RFQ workflow",
    outcome: "Define the NEXUS supplier RFQ workflow from purchase requirement to supplier responses.",
    expected: "A complete RFQ workflow supporting multiple suppliers and quote collection.",
    priority: "MUST_WIN", scheduled: "2026-09-01", deadline: "2026-09-01", minutes: 180,
  },
  {
    n: 12, phase: P1, title: "TASK 12 — Define quote-comparison workflow",
    outcome:
      "Define how NEXUS compares supplier quotes against price history and purchasing requirements.",
    expected:
      "Quote comparison identifies cheapest suitable supplier, price deviations and historical pricing.",
    priority: "MUST_WIN", scheduled: "2026-09-02", deadline: "2026-09-02", minutes: 180,
  },
  {
    n: 13, phase: P1, title: "TASK 13 — Define approval workflow",
    outcome: "Define configurable management approval rules for procurement transactions.",
    expected: "NEXUS can determine when purchases require manager, procurement or GM approval.",
    priority: "MUST_WIN", scheduled: "2026-09-03", deadline: "2026-09-03", minutes: 150,
  },
  {
    n: 14, phase: P1, title: "TASK 14 — Define purchase-order workflow",
    outcome: "Define the workflow that converts an approved purchase into a purchase order.",
    expected: "Approved purchases can be converted into controlled purchase orders.",
    priority: "SUPPORT", scheduled: "2026-09-04", deadline: "2026-09-04", minutes: 150,
  },
  {
    n: 15, phase: P1, title: "TASK 15 — Define invoice workflow",
    outcome:
      "Define how invoices enter NEXUS and are associated with suppliers, purchase orders and purchases.",
    expected:
      "NEXUS can associate invoices with procurement transactions and identify potential discrepancies.",
    priority: "SUPPORT", scheduled: "2026-09-05", deadline: "2026-09-05", minutes: 180,
  },
  {
    n: 16, phase: P1, title: "TASK 16 — Define procurement intelligence",
    outcome: "Define the initial intelligence NEXUS must detect from procurement data.",
    expected:
      "Initial intelligence includes supplier price increases, historical price deviations, supplier alternatives, approval requirements and duplicate invoices.",
    priority: "MUST_WIN", scheduled: "2026-09-06", deadline: "2026-09-06", minutes: 180,
  },

  {
    n: 17, phase: P2, title: "TASK 17 — Finalize V1 architecture",
    outcome: "Create the complete technical architecture for NEXUS V1.",
    expected:
      "Frontend, backend, database, authentication, automation, AI, storage and deployment architecture documented.",
    priority: "MUST_WIN", scheduled: "2026-09-07", deadline: "2026-09-07", minutes: 240,
  },
  {
    n: 18, phase: P2, title: "TASK 18 — Initialize Next.js application",
    outcome: "Create the production NEXUS frontend foundation using Next.js.",
    expected: "Working NEXUS frontend application with routing and core application structure.",
    priority: "SUPPORT", scheduled: "2026-09-08", deadline: "2026-09-08", minutes: 180,
  },
  {
    n: 19, phase: P2, title: "TASK 19 — Establish design system",
    outcome: "Create the NEXUS monochrome enterprise design system.",
    expected:
      "Reusable components, typography, spacing, tables, cards, alerts, navigation and data visualizations using the black/white/grey NEXUS aesthetic.",
    priority: "SUPPORT", scheduled: "2026-09-09", deadline: "2026-09-10", minutes: 360,
  },
  {
    n: 20, phase: P2, title: "TASK 20 — Create PostgreSQL database",
    outcome: "Create the core NEXUS PostgreSQL database architecture.",
    expected:
      "Database supports companies, users, suppliers, products, requests, quotes, approvals, purchase orders and invoices.",
    priority: "MUST_WIN", scheduled: "2026-09-11", deadline: "2026-09-12", minutes: 480,
  },
  {
    n: 21, phase: P2, title: "TASK 21 — Implement authentication",
    outcome: "Implement secure user authentication and organization access.",
    expected: "Users can securely sign in and access their company's NEXUS environment.",
    priority: "MUST_WIN", scheduled: "2026-09-13", deadline: "2026-09-13", minutes: 180,
  },
  {
    n: 22, phase: P2, title: "TASK 22 — Implement organization architecture",
    outcome: "Create multi-company data isolation for NEXUS.",
    expected: "Each company's data is logically isolated and associated with its authorized users.",
    priority: "MUST_WIN", scheduled: "2026-09-14", deadline: "2026-09-14", minutes: 240,
  },

  {
    n: 23, phase: P3, title: "TASK 23 — Build Command Center",
    outcome:
      "Build the NEXUS executive Command Center showing the current procurement state of the company.",
    expected:
      "Executive dashboard shows spend, pending approvals, supplier activity, procurement pipeline, alerts and key metrics.",
    priority: "MUST_WIN", scheduled: "2026-09-15", deadline: "2026-09-18", minutes: 600,
  },
  {
    n: 24, phase: P3, title: "TASK 24 — Build procurement KPI layer",
    outcome: "Implement the core procurement KPIs used by the Command Center.",
    expected:
      "NEXUS calculates spend, purchase volume, approval time, supplier performance and procurement activity.",
    priority: "SUPPORT", scheduled: "2026-09-19", deadline: "2026-09-19", minutes: 240,
  },

  {
    n: 25, phase: P4, title: "TASK 25 — Build purchase requests",
    outcome: "Build the NEXUS purchase-request system.",
    expected:
      "Employees can create purchase requests containing required products, quantities, specifications and justification.",
    priority: "MUST_WIN", scheduled: "2026-09-20", deadline: "2026-09-22", minutes: 480,
  },
  {
    n: 26, phase: P4, title: "TASK 26 — Build approval engine",
    outcome: "Build configurable procurement approval rules.",
    expected:
      "NEXUS automatically routes purchases to the correct approver based on rules such as amount or category.",
    priority: "MUST_WIN", scheduled: "2026-09-23", deadline: "2026-09-24", minutes: 360,
  },
  {
    n: 27, phase: P4, title: "TASK 27 — Build supplier RFQs",
    outcome: "Build the supplier RFQ workflow.",
    expected: "Procurement users can select suppliers and issue RFQs while tracking responses.",
    priority: "MUST_WIN", scheduled: "2026-09-25", deadline: "2026-09-27", minutes: 480,
  },
  {
    n: 28, phase: P4, title: "TASK 28 — Build quote management",
    outcome: "Build quote capture and comparison functionality.",
    expected: "NEXUS displays supplier quotes side-by-side and identifies pricing differences.",
    priority: "MUST_WIN", scheduled: "2026-09-28", deadline: "2026-09-30", minutes: 480,
  },
  {
    n: 29, phase: P4, title: "TASK 29 — Build purchase orders",
    outcome: "Build the NEXUS purchase-order workflow.",
    expected: "Approved purchases can generate and track purchase orders.",
    priority: "SUPPORT", scheduled: "2026-10-01", deadline: "2026-10-02", minutes: 360,
  },

  {
    n: 30, phase: P5, title: "TASK 30 — Build supplier database",
    outcome: "Build the NEXUS supplier intelligence database.",
    expected:
      "Each supplier has profile, products, pricing history, transaction history and performance information.",
    priority: "MUST_WIN", scheduled: "2026-10-03", deadline: "2026-10-04", minutes: 360,
  },
  {
    n: 31, phase: P5, title: "TASK 31 — Build supplier performance",
    outcome: "Calculate supplier performance metrics from procurement data.",
    expected:
      "NEXUS displays supplier reliability, pricing behaviour, transaction volume and performance trends.",
    priority: "SUPPORT", scheduled: "2026-10-05", deadline: "2026-10-05", minutes: 240,
  },
  {
    n: 32, phase: P5, title: "TASK 32 — Build price-history intelligence",
    outcome: "Implement historical supplier and product price comparisons.",
    expected:
      "NEXUS can detect abnormal price changes and compare current prices with historical averages.",
    priority: "MUST_WIN", scheduled: "2026-10-06", deadline: "2026-10-07", minutes: 360,
  },

  {
    n: 33, phase: P6, title: "TASK 33 — Build spend dashboard",
    outcome: "Build procurement spend visibility within NEXUS.",
    expected: "Management can see spend by supplier, product, category and period.",
    priority: "SUPPORT", scheduled: "2026-10-08", deadline: "2026-10-09", minutes: 360,
  },
  {
    n: 34, phase: P6, title: "TASK 34 — Build invoice management",
    outcome: "Build invoice ingestion and tracking.",
    expected:
      "Invoices can be captured, associated with procurement transactions and tracked through approval.",
    priority: "SUPPORT", scheduled: "2026-10-10", deadline: "2026-10-11", minutes: 360,
  },
  {
    n: 35, phase: P6, title: "TASK 35 — Build duplicate-invoice detection",
    outcome: "Implement automated duplicate invoice detection.",
    expected: "NEXUS flags potentially duplicated invoices before payment.",
    priority: "MUST_WIN", scheduled: "2026-10-12", deadline: "2026-10-12", minutes: 240,
  },

  {
    n: 36, phase: P7, title: "TASK 36 — Define operational intelligence model",
    outcome: "Define the minimum operational data NEXUS needs to identify bottlenecks and delays.",
    expected: "A narrow operational model that connects procurement activity to operational performance.",
    priority: "SUPPORT", scheduled: "2026-10-13", deadline: "2026-10-13", minutes: 180,
  },
  {
    n: 37, phase: P7, title: "TASK 37 — Build operational KPI view",
    outcome: "Build the initial NEXUS operational KPI dashboard.",
    expected:
      "NEXUS can display selected operational metrics and identify bottlenecks where data is available.",
    priority: "BACKLOG", scheduled: "2026-10-14", deadline: "2026-10-15", minutes: 360,
  },

  {
    n: 38, phase: P8, title: "TASK 38 — Build intelligence data pipeline",
    outcome: "Create the pipeline that transforms procurement data into structured intelligence inputs.",
    expected: "Structured procurement data is available for rules, analytics and AI reasoning.",
    priority: "MUST_WIN", scheduled: "2026-10-16", deadline: "2026-10-17", minutes: 360,
  },
  {
    n: 39, phase: P8, title: "TASK 39 — Build price anomaly detection",
    outcome: "Automatically detect significant deviations from historical product pricing.",
    expected: 'NEXUS produces alerts such as "Product X is 19% above historical average."',
    priority: "MUST_WIN", scheduled: "2026-10-18", deadline: "2026-10-18", minutes: 240,
  },
  {
    n: 40, phase: P8, title: "TASK 40 — Build supplier-price intelligence",
    outcome: "Detect supplier price increases and unusual supplier pricing behaviour.",
    expected: "NEXUS identifies significant supplier pricing changes and their potential financial impact.",
    priority: "MUST_WIN", scheduled: "2026-10-19", deadline: "2026-10-19", minutes: 240,
  },
  {
    n: 41, phase: P8, title: "TASK 41 — Build alternative-supplier intelligence",
    outcome: "Identify alternative suppliers capable of supplying required products.",
    expected: "NEXUS can identify multiple potential suppliers for purchasing decisions.",
    priority: "SUPPORT", scheduled: "2026-10-20", deadline: "2026-10-21", minutes: 360,
  },
  {
    n: 42, phase: P8, title: "TASK 42 — Build procurement risk detection",
    outcome: "Detect procurement conditions that require management attention.",
    expected:
      "NEXUS identifies abnormal spend, supplier concentration, pricing anomalies and approval risks.",
    priority: "SUPPORT", scheduled: "2026-10-22", deadline: "2026-10-22", minutes: 240,
  },

  {
    n: 43, phase: P9, title: "TASK 43 — Build automation engine",
    outcome: "Create the NEXUS workflow automation layer using n8n.",
    expected: "NEXUS can trigger automated actions based on defined business conditions.",
    priority: "MUST_WIN", scheduled: "2026-10-23", deadline: "2026-10-24", minutes: 360,
  },
  {
    n: 44, phase: P9, title: "TASK 44 — Automate approval notifications",
    outcome: "Automatically notify the correct approver when procurement approval is required.",
    expected: "Approvals no longer depend on manually checking the system.",
    priority: "SUPPORT", scheduled: "2026-10-25", deadline: "2026-10-25", minutes: 180,
  },
  {
    n: 45, phase: P9, title: "TASK 45 — Automate RFQ generation",
    outcome: "Automatically generate supplier RFQs from approved procurement requests.",
    expected: "Approved purchase requirements can trigger RFQ generation automatically.",
    priority: "SUPPORT", scheduled: "2026-10-26", deadline: "2026-10-26", minutes: 240,
  },
  {
    n: 46, phase: P9, title: "TASK 46 — Build AI recommendation engine",
    outcome: "Implement structured AI recommendations based on NEXUS procurement intelligence.",
    expected: "NEXUS can explain detected problems, estimate impact and recommend appropriate actions.",
    priority: "MUST_WIN", scheduled: "2026-10-27", deadline: "2026-10-29", minutes: 600,
  },

  {
    n: 47, phase: P10, title: "TASK 47 — Build audit trail",
    outcome: "Record every significant user, automation and approval action inside NEXUS.",
    expected:
      "Management can determine who performed what action, when it happened and what changed.",
    priority: "MUST_WIN", scheduled: "2026-10-30", deadline: "2026-10-31", minutes: 360,
  },

  {
    n: 48, phase: P11, title: "TASK 48 — Build proactive alert engine",
    outcome:
      "Create an intelligence engine that proactively identifies significant business problems instead of waiting for executives to search for them.",
    expected: "NEXUS proactively surfaces high-value procurement problems requiring management attention.",
    priority: "MUST_WIN", scheduled: "2026-11-01", deadline: "2026-11-02", minutes: 480,
  },
  {
    n: 49, phase: P11, title: "TASK 49 — Build financial-impact estimation",
    outcome: "Calculate the estimated financial impact of significant procurement anomalies.",
    expected: "Alerts include estimated financial impact rather than simply identifying problems.",
    priority: "MUST_WIN", scheduled: "2026-11-03", deadline: "2026-11-03", minutes: 240,
  },
  {
    n: 50, phase: P11, title: "TASK 50 — Build recommended-action engine",
    outcome: "Generate actionable recommendations for detected procurement problems.",
    expected: "Each major alert contains problem, cause, estimated impact and recommended next action.",
    priority: "MUST_WIN", scheduled: "2026-11-04", deadline: "2026-11-04", minutes: 300,
  },
  {
    n: 51, phase: P11, title: "TASK 51 — Build executive alert interface",
    outcome: "Create the NEXUS executive intelligence interface for proactive business alerts.",
    expected:
      "Example — 🔴 STEEL EXPENDITURE INCREASED 12.8% · Estimated annual impact: R2.1M · Primary cause: Supplier pricing · Recommended action: Request competitive quotes · [GENERATE RFQs]",
    priority: "MUST_WIN", scheduled: "2026-11-05", deadline: "2026-11-05", minutes: 300,
  },

  {
    n: 52, phase: P12, title: "TASK 52 — Prepare customer demo environment",
    outcome: "Create a realistic NEXUS procurement dataset and polished demo environment.",
    expected:
      "NEXUS can demonstrate supplier intelligence, procurement workflows, approvals, spend and proactive alerts.",
    priority: "MUST_WIN", scheduled: "2026-11-06", deadline: "2026-11-06", minutes: 300,
  },
  {
    n: 53, phase: P12, title: "TASK 53 — Conduct first live NEXUS demonstration",
    outcome: "Demonstrate NEXUS to the first qualified prospective customer.",
    expected: "A real company sees NEXUS operating against a relevant procurement scenario.",
    priority: "MUST_WIN", scheduled: "2026-11-07", deadline: "2026-11-07", minutes: 180,
  },
  {
    n: 54, phase: P12, title: "TASK 54 — Offer procurement intelligence assessment",
    outcome:
      "Offer the prospect a NEXUS procurement assessment that identifies operational inefficiencies and potential savings.",
    expected:
      "Prospect receives a concrete business case showing where NEXUS could create financial and operational value.",
    priority: "MUST_WIN", scheduled: "2026-11-08", deadline: "2026-11-08", minutes: 180,
  },
  {
    n: 55, phase: P12, title: "TASK 55 — Create first commercial proposal",
    outcome: "Create and submit the first NEXUS commercial proposal.",
    expected:
      "Proposal includes implementation, platform pricing, scope, expected outcome and deployment timeline.",
    priority: "MUST_WIN", scheduled: "2026-11-09", deadline: "2026-11-09", minutes: 180,
  },
  {
    n: 56, phase: P12, title: "TASK 56 — CLOSE FIRST CUSTOMER",
    outcome: "Sign the first paying NEXUS customer.",
    expected:
      "A real company signs an agreement and pays for NEXUS implementation and/or platform access.",
    priority: "MUST_WIN", scheduled: "2026-11-10", deadline: "2026-11-11", minutes: 480,
  },

  {
    n: 57, phase: P13, title: "TASK 57 — Deploy NEXUS to first customer",
    outcome: "Deploy NEXUS Procurement Intelligence into the first customer's environment.",
    expected: "The customer is actively using NEXUS with real procurement data.",
    priority: "MUST_WIN", scheduled: "2026-11-11", deadline: "2026-11-20", minutes: 1200,
  },
  {
    n: 58, phase: P13, title: "TASK 58 — Establish customer baseline",
    outcome: "Measure the customer's procurement performance before NEXUS intervention.",
    expected:
      "Baseline established for procurement time, spend, approvals, supplier pricing and relevant inefficiencies.",
    priority: "MUST_WIN", scheduled: "2026-11-21", deadline: "2026-11-21", minutes: 180,
  },
  {
    n: 59, phase: P13, title: "TASK 59 — Measure NEXUS ROI",
    outcome: "Measure the financial and operational improvement generated by NEXUS.",
    expected: "Documented evidence of money saved, time saved, visibility gained or risk reduced.",
    priority: "MUST_WIN", scheduled: "2026-11-28", deadline: "2026-11-28", minutes: 240,
  },
  {
    n: 60, phase: P13, title: "TASK 60 — Create first NEXUS case study",
    outcome: "Create the first NEXUS customer case study based on measured results.",
    expected: "A quantified customer success story that can be used to acquire the next customers.",
    priority: "SUPPORT", scheduled: "2026-11-29", deadline: "2026-11-30", minutes: 300,
  },
];

/**
 * COMMAND allows one must-win per day — one outcome that decides whether the
 * day counted. Where two must-wins share a date, the later one is scheduled as
 * SUPPORT so the rule holds, and recorded here so the decision is visible
 * rather than silent. Change the date or the priority in the app to override.
 */
export const MUST_WIN_CONFLICTS: Array<{ date: string; kept: number; demoted: number }> = [
  { date: "2026-08-15", kept: 1, demoted: 2 },
];
