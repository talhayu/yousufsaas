import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, Plus, Search, Upload } from "lucide-react";
import { api, download } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, GhostButton, Modal, PrimaryButton, RemediationModal, RiskBadge, StatusBadge, exportReport } from "../components/ui";
import type { Application, Control } from "../types";

const BASE_CATEGORIES = [
  "Analytics",
  "CRM",
  "Communication",
  "Customer Support",
  "Development",
  "HR",
  "Other",
  "Productivity",
  "Storage",
  "Design",
  "comms",
  "design",
];

type AppForm = {
  name: string;
  category: string;
  risk: Application["risk"];
  userCount: number;
  costPerUser: number;
  flatMonthly: number;
  billingCycle: "Monthly" | "Annual";
  renewalDate: string;
};

const emptyForm: AppForm = {
  name: "",
  category: "",
  risk: "Medium",
  userCount: 1,
  costPerUser: 0,
  flatMonthly: 0,
  billingCycle: "Monthly",
  renewalDate: new Date().toISOString().slice(0, 10),
};

export function Applications() {
  const { tick } = useRefresh();
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: keyof Application; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<number[]>([]);
  const [form, setForm] = useState<AppForm | null>(null);
  const [editing, setEditing] = useState<Application | null>(null);
  const [detail, setDetail] = useState<(Application & { controls: Control[] }) | null>(null);
  const [remediation, setRemediation] = useState<{ appId: number; code: string; appName: string; title: string; flaw: string } | null>(null);
  const [riskReview, setRiskReview] = useState<Array<{ name: string; failures: Array<{ code: string; title: string; evidence: string }> }> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number[] | null>(null);

  async function load() {
    const data = await api<{ applications: Application[] }>("/api/applications");
    setApps(data.applications);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load applications."));
  }, [tick]);

  const categoryOptions = useMemo(() => {
    const found = new Set(apps.map((app) => app.category));
    return [...new Set([...BASE_CATEGORIES, ...found])];
  }, [apps]);

  const visible = useMemo(() => {
    const rows = apps.filter((app) => {
      if (query && !app.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (categories.length && !categories.includes(app.category)) return false;
      if (risks.length && !risks.includes(app.risk)) return false;
      if (statuses.length && !statuses.includes(app.status)) return false;
      return true;
    });
    rows.sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const result = String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
      return sort.dir === "asc" ? result : -result;
    });
    return rows;
  }, [apps, query, categories, risks, statuses, sort]);

  function toggle(list: string[], value: string, setList: (next: string[]) => void) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function toggleRow(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function openDetail(app: Application) {
    const data = await api<{ application: Application & { controls: Control[] } }>(`/api/applications/${app.id}`);
    setDetail(data.application);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError("");
    try {
      if (editing) {
        await api(`/api/applications/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await api("/api/applications", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(null);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the application.");
    }
  }

  async function remove(ids: number[]) {
    await api("/api/applications/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) });
    setSelected([]);
    setDetail(null);
    setConfirmDelete(null);
    await load();
  }

  async function importCsv(file: File) {
    const csv = await file.text();
    const result = await api<{ imported: number; errors: string[] }>("/api/applications/import", {
      method: "POST",
      body: JSON.stringify({ csv }),
    });
    if (result.errors.length) setError(result.errors.slice(0, 3).join(" "));
    await load();
  }

  async function reviewRisks(ids: number[]) {
    const data = await api<{ applications: Array<{ name: string; failures: Array<{ code: string; title: string; evidence: string }> }> }>(
      "/api/applications/risks",
      { method: "POST", body: JSON.stringify({ ids }) },
    );
    setRiskReview(data.applications);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">SaaS Applications</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage and monitor {visible.length} applications across your organization</p>
        </div>
      </div>
      <Banner message={error} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1">
          <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
          <input className="field pl-9" placeholder="Search applications by name" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <GhostButton onClick={() => download("/api/applications/export", "yusrflow-applications.csv").catch((err) => setError(err.message))}>
          <Download size={16} /> Export
        </GhostButton>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
          <Upload size={16} /> Import Application
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importCsv(file).catch((err) => setError(err.message));
              event.target.value = "";
            }}
          />
        </label>
        <PrimaryButton
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
          }}
        >
          <Plus size={16} /> Add Application
        </PrimaryButton>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-[#14151c] p-4">
          <h2 className="text-sm font-semibold">Filters</h2>
          <FilterGroup title="Category" options={categoryOptions} selected={categories} onToggle={(value) => toggle(categories, value, setCategories)} />
          <FilterGroup title="Risk Level" options={["Low Risk", "Medium Risk", "High Risk", "Critical Risk"]} selected={risks.map((item) => `${item} Risk`)} onToggle={(value) => toggle(risks, value.replace(" Risk", ""), setRisks)} />
          <FilterGroup title="Compliance Status" options={["Compliant", "Partially Compliant", "Non-Compliant", "Not Assessed"]} selected={statuses} onToggle={(value) => toggle(statuses, value, setStatuses)} />
        </aside>

        <div className="min-w-0 rounded-2xl border border-white/10 bg-[#14151c]">
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-zinc-400">
                <tr className="border-b border-white/8">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={visible.length > 0 && visible.every((app) => selected.includes(app.id))}
                      onChange={(event) => setSelected(event.target.checked ? visible.map((app) => app.id) : [])}
                    />
                  </th>
                  {([
                    ["name", "Application"],
                    ["category", "Category"],
                    ["compliance_score", "Compliance Score"],
                    ["risk", "Risk Level"],
                    ["status", "Status"],
                    ["user_count", "Users"],
                  ] as Array<[keyof Application, string]>).map(([key, label]) => (
                    <th key={key} className="px-3 py-3 font-medium">
                      <button
                        className="inline-flex items-center gap-1"
                        onClick={() => setSort({ key, dir: sort.key === key && sort.dir === "asc" ? "desc" : "asc" })}
                      >
                        {label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr
                    key={app.id}
                    className={`border-b border-white/5 hover:bg-white/5 ${selected.includes(app.id) ? "bg-[#6d5ef8]/10" : ""}`}
                  >
                    <td className="px-3 py-3">
                      <input type="checkbox" checked={selected.includes(app.id)} onChange={() => toggleRow(app.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <button className="text-left hover:text-[#c4b8ff]" onClick={() => openDetail(app).catch((err) => setError(err.message))}>
                        {app.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-zinc-300">{app.category}</td>
                    <td className={`px-3 py-3 font-medium ${scoreTone(app.compliance_score)}`}>
                      {app.compliance_score === null ? "—" : `${app.compliance_score}%`}
                    </td>
                    <td className="px-3 py-3">
                      <RiskBadge risk={app.risk} />
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-3 py-3">{app.user_count}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-zinc-400">
                      No applications match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {selected.length > 0 && (
            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#1a1b22] px-4 py-3">
              <span className="text-sm">{selected.length} Applications</span>
              <div className="flex flex-wrap gap-2">
                <GhostButton onClick={() => exportReport(selected).catch((err) => setError(err.message))}>Export Compliance Report</GhostButton>
                <GhostButton onClick={() => reviewRisks(selected).catch((err) => setError(err.message))}>Review Risks</GhostButton>
                <button className="rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10" onClick={() => setConfirmDelete(selected)}>
                  Delete
                </button>
                <button className="rounded-xl px-3 py-2 text-sm text-zinc-300" onClick={() => setSelected([])}>
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {form && (
        <Modal
          title={editing ? "Edit Application" : "Add Application"}
          subtitle={editing ? "Update this application." : "Add a new SaaS application to your inventory manually."}
          onClose={() => {
            setForm(null);
            setEditing(null);
          }}
        >
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2 text-sm">
              Application Name
              <input className="field mt-1" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="sm:col-span-2 text-sm">
              Category
              <input className="field mt-1" required placeholder="e.g. Design" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            </label>
            <label className="text-sm">
              Risk Level
              <select className="field mt-1" value={form.risk} onChange={(event) => setForm({ ...form, risk: event.target.value as AppForm["risk"] })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </label>
            <label className="text-sm">
              Users
              <input className="field mt-1" type="number" min={0} value={form.userCount} onChange={(event) => setForm({ ...form, userCount: Number(event.target.value) })} />
            </label>
            <label className="text-sm">
              Cost Per User (SAR)
              <input className="field mt-1" type="number" min={0} step="0.01" value={form.costPerUser} onChange={(event) => setForm({ ...form, costPerUser: Number(event.target.value) })} />
            </label>
            <label className="text-sm">
              Flat Monthly Cost (SAR)
              <input className="field mt-1" type="number" min={0} step="0.01" value={form.flatMonthly} onChange={(event) => setForm({ ...form, flatMonthly: Number(event.target.value) })} />
            </label>
            <label className="text-sm">
              Billing Cycle
              <select className="field mt-1" value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value as AppForm["billingCycle"] })}>
                <option>Monthly</option>
                <option>Annual</option>
              </select>
            </label>
            <label className="text-sm">
              Renewal Date
              <input className="field mt-1" type="date" required value={form.renewalDate} onChange={(event) => setForm({ ...form, renewalDate: event.target.value })} />
            </label>
            <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
              <GhostButton type="button" onClick={() => setForm(null)}>Cancel</GhostButton>
              <PrimaryButton type="submit">{editing ? "Save Application" : "Add Application"}</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50" onMouseDown={() => setDetail(null)}>
          <aside className="h-full w-full max-w-xl overflow-auto border-l border-white/10 bg-[#12131a] p-6" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{detail.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{detail.category}</p>
              </div>
              <button className="text-sm text-zinc-400" onClick={() => setDetail(null)}>Close</button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className={scoreTone(detail.compliance_score)}>{detail.compliance_score ?? "—"}%</span>
              <RiskBadge risk={detail.risk} />
              <StatusBadge status={detail.status} />
              <span className="text-zinc-400">{detail.user_count} users</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <GhostButton
                onClick={() => {
                  setEditing(detail);
                  setForm({
                    name: detail.name,
                    category: detail.category,
                    risk: detail.risk,
                    userCount: detail.user_count,
                    costPerUser: detail.cost_per_user,
                    flatMonthly: detail.flat_monthly_cost,
                    billingCycle: detail.billing_cycle,
                    renewalDate: detail.renewal_date,
                  });
                }}
              >
                Edit
              </GhostButton>
              <GhostButton onClick={() => exportReport([detail.id]).catch((err) => setError(err.message))}>Export Compliance Report</GhostButton>
              <GhostButton onClick={() => reviewRisks([detail.id]).catch((err) => setError(err.message))}>Review Risks</GhostButton>
              <button className="rounded-xl px-3 py-2 text-sm text-rose-300" onClick={() => setConfirmDelete([detail.id])}>Delete</button>
            </div>
            <div className="mt-6 space-y-5">
              {["PDPL", "NDMO", "NCA", "SDAIA", "GDPR"].map((framework) => {
                const controls = detail.controls.filter((control) => control.framework === framework);
                if (!controls.length) return null;
                return (
                  <section key={framework}>
                    <h3 className="mb-2 text-xs uppercase tracking-wide text-zinc-500">{framework}</h3>
                    <div className="space-y-2">
                      {controls.map((control) => (
                        <article key={control.code} className="rounded-xl border border-white/8 bg-black/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{control.code}</p>
                            {control.status === "pass" ? (
                              <span className="text-xs text-emerald-300">Sorted</span>
                            ) : control.status === "fail" ? (
                              <button
                                className="text-xs text-[#c4b8ff]"
                                onClick={() =>
                                  setRemediation({
                                    appId: detail.id,
                                    code: control.code,
                                    appName: detail.name,
                                    title: control.title,
                                    flaw: control.evidence,
                                  })
                                }
                              >
                                Fix issue
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-500">No evidence</span>
                            )}
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full ${control.status === "pass" ? "bg-emerald-400" : "bg-zinc-600"}`}
                              style={{ width: control.status === "pass" ? "100%" : "0%" }}
                            />
                          </div>
                          <p className="mt-2 text-right text-xs text-zinc-400">{control.status === "pass" ? "100%" : control.status === "fail" ? "0%" : "—"}</p>
                          <p className="text-sm leading-6 text-zinc-300">{control.evidence}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {remediation && (
        <RemediationModal
          {...remediation}
          onClose={() => setRemediation(null)}
          onResolved={() => {
            setRemediation(null);
            load().catch(() => undefined);
          }}
        />
      )}

      {riskReview && (
        <Modal title="Review Risks" subtitle="Failed controls for the selected applications." onClose={() => setRiskReview(null)} wide>
          <div className="space-y-4">
            {riskReview.map((app) => (
              <section key={app.name}>
                <h3 className="font-medium">{app.name}</h3>
                {app.failures.length === 0 && <p className="text-sm text-zinc-400">No failed controls.</p>}
                <ul className="mt-2 space-y-2">
                  {app.failures.map((failure) => (
                    <li key={failure.code} className="rounded-lg bg-black/30 px-3 py-2 text-sm">
                      <span className="text-[#c4b8ff]">{failure.code}</span> · {failure.title}
                      <p className="mt-1 text-zinc-400">{failure.evidence}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete applications" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-zinc-300">Delete {confirmDelete.length} application{confirmDelete.length === 1 ? "" : "s"} and their compliance history?</p>
          <div className="mt-4 flex justify-end gap-2">
            <GhostButton onClick={() => setConfirmDelete(null)}>Cancel</GhostButton>
            <button className="rounded-xl bg-rose-600 px-4 py-2 text-sm" onClick={() => remove(confirmDelete).catch((err) => setError(err.message))}>
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs text-zinc-500">{title}</p>
      <div className="mt-2 max-h-48 space-y-1 overflow-auto">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function scoreTone(score: number | null) {
  if (score === null) return "text-zinc-400";
  if (score >= 90) return "text-emerald-300";
  if (score >= 70) return "text-amber-200";
  return "text-rose-300";
}
