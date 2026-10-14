import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, RiskBadge, StatusBadge } from "../components/ui";
import { ago, signed } from "../format";
import type { Application, FrameworkCard } from "../types";

type DashboardData = {
  overall: number;
  overallDelta: number;
  frameworks: FrameworkCard[];
  stats: { users: number; compliant: number; partial: number; nonCompliant: number; total: number };
  alerts: Array<{ id: number; title: string; body: string; severity: string; created_at: string; app_name: string }>;
};

export function Dashboard() {
  const { tick } = useRefresh();
  const [data, setData] = useState<DashboardData | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    Promise.all([
      api<DashboardData>("/api/dashboard"),
      api<{ applications: Application[] }>("/api/applications"),
    ])
      .then(([dashboard, list]) => {
        if (cancelled) return;
        setData(dashboard);
        setApps(list.applications);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the dashboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const visible = useMemo(
    () =>
      apps.filter((app) => {
        const matchesQuery = app.name.toLowerCase().includes(query.toLowerCase());
        const matchesRisk = !risk || app.risk === risk;
        return matchesQuery && matchesRisk;
      }),
    [apps, query, risk],
  );

  if (!data && !error) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-zinc-300">
        <Loader2 className="animate-spin text-[#8d7bff]" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div>
      <Banner message={error} />
      {data && (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-[#14151c] p-5">
              <h2 className="text-lg font-semibold">Compliance Scores</h2>
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-gradient-to-br from-[#2a1520] to-[#141018] p-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-zinc-300">Overall Score</p>
                  <span className={`text-xs ${data.overallDelta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {signed(data.overallDelta)}
                  </span>
                </div>
                <p className="mt-2 text-5xl font-semibold text-rose-300">{data.overall}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {["PDPL", "NDMO", "SDAIA", "NCA"].map((code) => data.frameworks.find((item) => item.code === code)).filter((item) => item != null).map((item) => (
                  <article key={item.code} className="rounded-xl border border-white/8 bg-black/25 p-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{item.code}</span>
                      <span className={item.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>{signed(item.delta)}</span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-rose-200">{item.score}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#14151c] p-5">
              <h2 className="text-lg font-semibold">Active Alerts</h2>
              <div className="mt-4 space-y-3">
                {data.alerts.length === 0 && <p className="text-sm text-zinc-400">No active alerts.</p>}
                {data.alerts.map((alert) => (
                  <article key={alert.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-black/20 p-3">
                    <div className="flex gap-3">
                      <AlertTriangle className="mt-0.5 text-amber-300" size={18} />
                      <div>
                        <h3 className="text-sm font-medium">{alert.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-zinc-400">{alert.body}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {alert.app_name} • {ago(alert.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-200">{alert.severity}</span>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#14151c] p-5">
            <h2 className="text-lg font-semibold">Quick Stats</h2>
            <dl className="mt-3 divide-y divide-white/8">
              <Stat label="Total Users" value={data.stats.users} />
              <Stat label="Compliant Apps" value={data.stats.compliant} tone="text-emerald-300" />
              <Stat label="Partial Compliance" value={data.stats.partial} tone="text-amber-200" />
              <Stat label="Non-Compliant" value={data.stats.nonCompliant} tone="text-rose-300" />
            </dl>
          </section>

          <section className="mt-4 rounded-2xl border border-white/10 bg-[#14151c] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">SaaS Applications</h2>
              <div className="flex items-center gap-2">
                <label className="relative">
                  <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                  <input
                    className="field w-64 pl-9"
                    placeholder="Search apps, category..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <select className="field w-36" value={risk} onChange={(event) => setRisk(event.target.value)}>
                  <option value="">Filters</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <span className="text-sm text-zinc-400">{visible.length} apps</span>
              </div>
            </div>
            <div className="mt-4 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2">Application</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Risk</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.slice(0, 8).map((app) => (
                    <tr key={app.id} className="border-t border-white/5">
                      <td className="py-3">
                        <Link className="hover:text-[#c4b8ff]" to="/applications">
                          {app.name}
                        </Link>
                      </td>
                      <td className="text-zinc-400">{app.category}</td>
                      <td>{app.compliance_score === null ? "—" : `${app.compliance_score}%`}</td>
                      <td>
                        <RiskBadge risk={app.risk} />
                      </td>
                      <td>
                        <StatusBadge status={app.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className="text-zinc-400">{label}</dt>
      <dd className={`font-medium ${tone}`}>{value}</dd>
    </div>
  );
}
