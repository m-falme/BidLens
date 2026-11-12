import type { CapabilityKind } from "./rows";

/**
 * Hand transcription of data/zanari/zanari_company_profile.pdf (15 pages), verbatim where
 * quoted. The profile lists no certifications, registration documents, named clients or
 * case studies (p.14 "Our Clients" is logos only), so none are seeded: readiness must show
 * those requirements as missing until a human adds evidence.
 */

export const ZANARI_PROFILE_FILE = "zanari_company_profile.pdf";

export interface ProfileCapability {
  kind: CapabilityKind;
  name: string;
  detail: string | null;
  page: number;
}

export const zanariCompany = {
  name: "Zanari Analytics",
  profile: {
    legal_name: "Zanari Analytics Ltd",
    tagline: "Transforming Data into Actionable Insights",
    vision:
      "To become a global leading provider of Business Intelligence and AI-driven digital transformation solutions that empower organizations to thrive in the digital era.",
    mission:
      "To deliver secure, scalable, and innovative analytics, cloud, and AI solutions that enable data-driven excellence.",
    overview:
      "Zanari Analytics Ltd is a Business Intelligence, Data Analytics, Artificial Intelligence, and Digital Transformation company helping organisations unlock the full potential of their data.",
    core_values: [
      "Innovation",
      "Integrity",
      "Customer Success",
      "Quality & Reliability",
      "Collaboration",
      "Continuous Improvement",
    ],
    approach: [
      "Discovery & Assessment",
      "Solution Design",
      "Development & Implementation",
      "Testing & Deployment",
      "Training & Support",
    ],
    contact: {
      address: "iHiT, Dennis Pritt Road, Kilimani, Nairobi",
      phone: "+254 708 517 381",
      email: "info@zanarianalytics.com",
      website: "www.zanarianalytics.com",
    },
    source: { file: ZANARI_PROFILE_FILE, pages: 15 },
  },
} as const;

const service = (name: string, detail: string | null, page: number): ProfileCapability => ({
  kind: "service",
  name,
  detail,
  page,
});
const tool = (name: string, group: string): ProfileCapability => ({
  kind: "tool",
  name,
  detail: `Technology capabilities: ${group}`,
  page: 11,
});
const sector = (name: string): ProfileCapability => ({ kind: "sector", name, detail: null, page: 14 });

const group = (heading: string, page: number, items: readonly string[]): ProfileCapability[] =>
  items.map((item) => service(item, `Part of ${heading}`, page));

export const zanariCapabilities: readonly ProfileCapability[] = [
  // p.6 Our service portfolio
  service("Business Intelligence Solutions", "Design and implementation of analytics platforms and dashboards", 6),
  service("Data Analytics", "Business insights, reporting automation, and performance analytics", 6),
  service("Data Engineering", "Data pipelines, warehouses, and integration solutions", 6),
  service("AI & Machine Learning", "Intelligent systems and predictive analytics", 6),
  service(
    "Software Development",
    "Custom enterprise applications and digital platforms:ERP,Web and mobile apps, AI-Integrated Website development",
    6,
  ),
  service(
    "Training and Managed Analytics Services",
    "Training, adoption with Continuous support, optimization, and enhancement of analytics solutions",
    6,
  ),

  // p.7–9 capability detail
  ...group("Business Intelligence & Analytics", 7, [
    "Microsoft Power BI implementation",
    "Executive dashboards like Financial performance, Sales and Customer reports",
    "Operational reporting",
    "KPI monitoring",
    "Self-service analytics",
    "Automated reporting solutions",
    "Data visualisation and storytelling",
  ]),
  ...group("Data Engineering", 7, [
    "Data warehouse development",
    "ETL/ELT pipeline development",
    "Data integration",
    "Database design",
    "Data modelling",
    "Cloud data platforms",
    "Data quality management",
  ]),
  ...group("Artificial Intelligence & ML", 8, [
    "Predictive analytics",
    "Forecasting models",
    "AI-powered business insights",
    "Recommendation systems",
    "Intelligent automation",
    "Machine learning solutions",
  ]),
  ...group("Custom Software Development", 8, [
    "Enterprise applications",
    "Business process automation",
    "Web applications",
    "Digital platforms",
    "System integrations",
    "Custom software solutions",
  ]),
  ...group("Digital Transformation Consulting", 9, [
    "Digital transformation strategy",
    "Technology assessment",
    "Business process improvement",
    "Analytics maturity assessment",
    "Data governance advisory",
    "Training",
  ]),
  ...group("Training & Managed Services", 9, [
    "User training and capacity building",
    "System maintenance and technical support",
    "Software updates and performance optimisation",
    "Helpdesk and Service Level Agreement (SLA) support",
    "Documentation and knowledge transfer",
    "Ongoing consultation and technology advisory",
  ]),

  // p.11 Technology capabilities
  ...["Microsoft Azure", "SQL Server", "PostgreSQL", "MySQL", "Data Warehouses", "Data Lakes"].map((n) =>
    tool(n, "Data Platforms"),
  ),
  ...["ETL pipelines", "Data integration frameworks", "Apache Spark", "Apache Kafka"].map((n) =>
    tool(n, "Data Engineering"),
  ),
  ...["Python", "Web technologies", "API integrations", "Cloud-based applications"].map((n) =>
    tool(n, "Development"),
  ),
  ...["Machine Learning", "Generative AI", "Predictive Analytics", "Intelligent Automation"].map((n) =>
    tool(n, "Artificial Intelligence"),
  ),
  ...["Microsoft Power BI", "Microsoft Fabric", "Apache Superset/Custom BI", "Tableau"].map((n) =>
    tool(n, "Business Intelligence"),
  ),

  // p.14 Industries we support
  ...[
    "Financial Services",
    "Education",
    "Healthcare",
    "Retail",
    "Transport & Logistics",
    "Rental & Fleet Management",
    "Professional Services",
    "Government and Public Sector",
  ].map(sector),
];
