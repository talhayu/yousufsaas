import { useEffect, useState } from "react";
import { Download, Loader2, Shield } from "lucide-react";
import { api } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, GhostButton, Modal, RemediationModal, StatusBadge, exportReport } from "../components/ui";
import { formatDay, formatStamp, signed } from "../format";
import type { FrameworkCard, Issue } from "../types";

type ComplianceData = {
  overall: number;
  frameworks: FrameworkCard[];
  counts: {
    critical: number;
    open: number;
    inProgress: number;
    resolved: number;
    criticalDelta: number;
    openDelta: number;
    inProgressDelta: number;
    resolvedDelta: number;
  };
  issues: Issue[];
  activity: Array<{ id: number; title: string; body: string; happened_at: string }>;
};

export function Compliance() {
  const { tick } = useRefresh();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [method, setMethod] = useState("");
  const [active, setActive] = useState<Issue | null>(null);

  function load() {
    return api<ComplianceData>("/api/compliance").then(setData);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load compliance."));
  }, [tick]);

  async function scan() {
    setScanning(true);
    setError("");
    try {
      setData(await api<ComplianceData>("/api/compliance/scan", { method: "POST" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function showMethod() {
    const result = await api<{ principle: string; frameworks: string[]; thresholds: string }>("/api/compliance/methodology");
    setMethod(`${result.principle}\n\nFrameworks: ${result.frameworks.join(", ")}.\n\n${result.thresholds}`);
  }

  if (!data && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-300">
        <Loader2 className="animate-spin text-[#8d7bff]" />
      </div>
    );
  }

  return (
    <div>
      <Banner message={error} />
      {data && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-semibold">
                <Shield size={26} className="text-[#8d7bff]" /> Compliance Dashboard
              </h1>
              <p className="mt-1 text-sm text-zinc-400">Monitor and track compliance status across all regulations and applications</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={() => void scan()} disabled={scanning}>{scanning ? "Scanning..." : "Run Scan"}</GhostButton>
              <GhostButton onClick={() => showMethod().catch((err) => setError(err.message))}>Methodology</GhostButton>
              <GhostButton onClick={() => exportReport().catch((err) => setError(err.message))}>
                <Download size={16} /> Download Report
              </GhostButton>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CountCard label="Critical Issues" value={data.counts.critical} delta={data.counts.criticalDelta} />
            <CountCard label="Open Issues" value={data.counts.open} delta={data.counts.openDelta} />
            <CountCard label="In Progress" value={data.counts.inProgress} delta={data.counts.inProgressDelta} />
            <CountCard label="Resolved" value={data.counts.resolved} delta={data.counts.resolvedDelta} />
          </div>

          <h2 className="mt-6 text-lg font-semibold">Regulatory Compliance Scores</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-5">
            {data.frameworks.map((item) => (
              <article key={item.code} className="rounded-2xl border border-[#5a4a22] bg-gradient-to-b from-[#2a2414] to-[#16140e] p-4">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span>{item.code}</span>
                  <span className={item.delta >= 0 ? "text-emerald-300" : "text-rose-300"}>{signed(item.delta)}</span>
                </div>
                <p className="mt-3 text-4xl font-semibold">{item.score}%</p>
                <div className="mt-3 h-1.5 rounded-full bg-rose-900/80">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${item.score}%` }} />
                </div>
                <p className="mt-2 text-xs text-rose-300">{item.label}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <section>
              <h2 className="mb-3 text-lg font-semibold">Active Issues</h2>
              <div className="space-y-3">
                {data.issues.length === 0 && <p className="text-sm text-zinc-400">No open issues.</p>}
                {data.issues.map((issue) => (
                  <button
                    key={issue.id}
                    className="block w-full rounded-2xl border border-amber-900/60 border-l-4 border-l-amber-500 bg-[#1a140f] p-4 text-left"
                    onClick={() => setActive(issue)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium text-amber-100">
                        {issue.app_name} - {issue.title}
                      </h3>
                      <StatusBadge status={issue.status} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{issue.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/15 px-2 py-0.5">{issue.framework}</span>
                      <span className="text-zinc-400">Affected application: {issue.app_name}</span>
                      <span className="text-zinc-400">Due {formatDay(issue.due_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-white/10 bg-[#14151c] p-4">
              <h2 className="font-semibold">Recent Activity</h2>
              <h3 className="mt-3 text-sm text-zinc-400">Compliance Activity</h3>
              <div className="mt-3 space-y-4">
                {data.activity.map((item) => (
                  <article key={item.id} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-zinc-500">{formatStamp(item.happened_at)}</p>
                      <p className="mt-1 text-sm text-zinc-400">{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

      {method && (
        <Modal title="Methodology" onClose={() => setMethod("")}>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{method}</p>
        </Modal>
      )}

      {active && (
        <RemediationModal
          issueId={active.id}
          appName={active.app_name}
          title={active.title}
          flaw={active.description}
          onClose={() => setActive(null)}
          onResolved={() => {
            setActive(null);
            load().catch((err) => setError(err.message));
          }}
        />
      )}
    </div>
  );
}

function CountCard({ label, value, delta }: { label: string; value: number; delta: number }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#14151c] p-4">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className={delta >= 0 ? "text-emerald-300" : "text-rose-300"}>{signed(delta)}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </article>
  );
}
