import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { api, downloadHtml } from "../api";
import type { Guide } from "../types";

export function Banner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {message}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const tone =
    risk === "Critical"
      ? "bg-rose-500/15 text-rose-300"
      : risk === "High"
        ? "bg-orange-500/15 text-orange-300"
        : risk === "Low"
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-amber-400/15 text-amber-200";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{risk} Risk</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Compliant" || status === "resolved" || status === "Sorted"
      ? "text-emerald-300"
      : status === "Partially Compliant" || status === "in_progress"
        ? "text-amber-200"
        : status === "Not Assessed"
          ? "text-zinc-400"
          : "text-rose-300";
  const label = status === "in_progress" ? "In Progress" : status === "resolved" ? "Resolved" : status === "open" ? "Open" : status;
  return <span className={`text-xs font-medium ${tone}`}>{label}</span>;
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose}>
      <div
        className={`max-h-[88vh] w-full overflow-auto rounded-2xl border border-white/10 bg-[#14151c] shadow-2xl ${wide ? "max-w-3xl" : "max-w-xl"}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
          </div>
          <button className="rounded-lg p-1 text-zinc-400 hover:bg-white/5 hover:text-white" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d5ef8] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#5b4de0] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 hover:bg-white/10 disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function RemediationModal({
  issueId,
  appId,
  code,
  appName,
  title,
  flaw,
  onClose,
  onResolved,
}: {
  issueId?: number;
  appId?: number;
  code?: string;
  appName: string;
  title: string;
  flaw: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [activeIssueId, setActiveIssueId] = useState<number | undefined>(issueId);

  async function generate(id?: number) {
    setLoading(true);
    setError("");
    setGuide(null);
    try {
      const issue = id ?? activeIssueId;
      const data = await api<{ issue: { id: number }; guide: Guide }>("/api/compliance/remediate", {
        method: "POST",
        body: JSON.stringify({ issueId: issue, appId, code }),
      });
      setActiveIssueId(data.issue.id);
      setGuide(data.guide);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Groq could not generate a guide.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = issueId;
        if (!id) {
          const opened = await api<{ issue: { id: number } }>("/api/compliance/issues", {
            method: "POST",
            body: JSON.stringify({ appId, code }),
          });
          id = opened.issue.id;
          if (!cancelled) setActiveIssueId(id);
        }
        if (!cancelled) await generate(id);
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError(err instanceof Error ? err.message : "Could not open this issue.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Open once per modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markResolved() {
    if (!activeIssueId) return;
    setResolving(true);
    try {
      await api(`/api/compliance/issues/${activeIssueId}/resolve`, { method: "POST" });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve the issue.");
    } finally {
      setResolving(false);
    }
  }

  return (
    <Modal title="AI Remediation Analysis" subtitle={`${appName} - ${title}`} onClose={onClose} wide>
      <div className="rounded-xl border border-indigo-300/20 bg-[#1b1a2e] px-4 py-3 text-sm leading-6 text-zinc-200">
        <span className="font-semibold text-white">Identified Flaw: </span>
        {guide?.identifiedFlaw || flaw}
      </div>

      {loading && (
        <div className="mt-4 flex min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-black/30 text-sm text-zinc-300">
          <Loader2 className="animate-spin text-[#8d7bff]" />
          Groq is gathering context and generating a specific fix for {appName}...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          <p>{error}</p>
          <button className="mt-2 text-[#c4b8ff] underline" onClick={() => void generate()}>
            Try again
          </button>
        </div>
      )}

      {guide && (
        <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
          <h3 className="font-semibold">{guide.guideTitle}</h3>
          <p className="text-sm leading-6 text-zinc-300">
            <span className="font-medium text-white">Issue: </span>
            {guide.issue}
          </p>
          <p className="text-sm leading-6 text-zinc-300">
            <span className="font-medium text-white">Objective: </span>
            {guide.objective}
          </p>
          <p className="text-sm leading-6 text-zinc-300">
            <span className="font-medium text-white">Target Audience: </span>
            {guide.targetAudience}
          </p>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Step-by-step remediation</h4>
            <ol className="space-y-3">
              {guide.steps.map((step, index) => (
                <li key={`${step.title}-${index}`}>
                  <p className="text-sm font-medium">
                    {index + 1}. {step.title}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                    {step.actions.map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
          {guide.alternatives.length > 0 && (
            <div>
              <h4 className="font-semibold">PDPL-compliant alternatives for {appName}</h4>
              <p className="mt-1 text-sm text-zinc-400">
                If remediation is not feasible, consider switching to one of these applications.
              </p>
              <div className="mt-3 space-y-3">
                {guide.alternatives.map((item) => (
                  <article key={item.name} className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{item.name}</h5>
                        <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs text-emerald-200">{item.badge}</span>
                      </div>
                      {item.url && (
                        <a className="text-sm text-emerald-200 underline" href={item.url} target="_blank" rel="noreferrer">
                          Visit
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-50/80">{item.summary}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-3">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <button
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          disabled={!activeIssueId || resolving}
          onClick={() => void markResolved()}
        >
          {resolving ? "Saving..." : "Mark as Resolved"}
        </button>
      </div>
    </Modal>
  );
}

export async function exportReport(ids?: number[]) {
  const data = await api<{ report: { id: number; html: string } }>("/api/reports", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
  downloadHtml(`yusrflow-report-${data.report.id}.html`, data.report.html);
}
