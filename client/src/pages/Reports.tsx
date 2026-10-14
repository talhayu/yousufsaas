import { useEffect, useState } from "react";
import { api, downloadHtml } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, PrimaryButton } from "../components/ui";
import { formatStamp } from "../format";

type Report = { id: number; title: string; created_at: string; html?: string };

export function Reports() {
  const { tick } = useRefresh();
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    return api<{ reports: Report[] }>("/api/reports").then((data) => setReports(data.reports));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load reports."));
  }, [tick]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ report: Report }>("/api/reports", { method: "POST", body: JSON.stringify({}) });
      if (data.report.html) downloadHtml(`yusrflow-report-${data.report.id}.html`, data.report.html);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the report.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExisting(id: number) {
    const data = await api<{ report: Report }>(`/api/reports/${id}`);
    if (data.report.html) downloadHtml(`yusrflow-report-${id}.html`, data.report.html);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Reports</h1>
          <p className="mt-1 text-sm text-zinc-400">Download audit-ready compliance reports for the current estate.</p>
        </div>
        <PrimaryButton onClick={() => void generate()} disabled={busy}>{busy ? "Generating..." : "Generate report"}</PrimaryButton>
      </div>
      <Banner message={error} />
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#14151c]">
        {reports.length === 0 && <p className="p-6 text-sm text-zinc-400">No reports yet. Generate one from here or from the compliance dashboard.</p>}
        {reports.map((report) => (
          <div key={report.id} className="flex items-center justify-between border-b border-white/5 px-5 py-4 last:border-0">
            <div>
              <p className="font-medium">{report.title}</p>
              <p className="text-xs text-zinc-500">{formatStamp(report.created_at)}</p>
            </div>
            <button className="text-sm text-[#c4b8ff]" onClick={() => downloadExisting(report.id).catch((err) => setError(err.message))}>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
