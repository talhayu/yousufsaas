export type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export type Application = {
  id: number;
  name: string;
  category: string;
  risk: "Low" | "Medium" | "High" | "Critical";
  user_count: number;
  cost_per_user: number;
  flat_monthly_cost: number;
  billing_cycle: "Monthly" | "Annual";
  renewal_date: string;
  source?: string;
  compliance_score: number | null;
  status: string;
};

export type Control = {
  code: string;
  framework: string;
  title: string;
  status: "pass" | "fail" | "unknown";
  evidence: string;
};

export type Issue = {
  id: number;
  app_id: number;
  app_name: string;
  code: string;
  framework: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  due_date: string | null;
};

export type Guide = {
  identifiedFlaw: string;
  guideTitle: string;
  issue: string;
  objective: string;
  targetAudience: string;
  steps: Array<{ title: string; actions: string[] }>;
  alternatives: Array<{ name: string; badge: string; summary: string; url: string }>;
};

export type FrameworkCard = {
  code: string;
  score: number;
  label: string;
  delta: number;
};
