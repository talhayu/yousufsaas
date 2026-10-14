import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, GhostButton, Modal, PrimaryButton } from "../components/ui";
import { formatStamp } from "../format";

type Integration = {
  provider: string;
  name: string;
  status: string;
  connected_at: string | null;
  last_discovery_at: string | null;
  detail: string;
};

export function Integrations() {
  const { tick } = useRefresh();
  const [items, setItems] = useState<Integration[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [manage, setManage] = useState(false);

  async function load() {
    const data = await api<{ integrations: Integration[] }>("/api/integrations");
    setItems(data.integrations);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load integrations."));
  }, [tick]);

  const microsoft = items.find((item) => item.provider === "microsoft");
  const other = items.find((item) => item.provider !== "microsoft");

  async function run(action: string, path: string) {
    setBusy(action);
    setError("");
    try {
      await api(path, { method: "POST" });
      await load();
      setManage(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Integrations</h1>
      <p className="mt-1 text-sm text-zinc-400">Connect your cloud services to enable automated discovery and compliance monitoring</p>
      <Banner message={error} />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-[#14151c] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 grid-cols-2 gap-0.5">
                <i className="bg-[#f35325]" />
                <i className="bg-[#81bc06]" />
                <i className="bg-[#05a6f0]" />
                <i className="bg-[#ffba08]" />
              </span>
              <div>
                <h2 className="font-semibold">Microsoft 365</h2>
                {microsoft?.status === "connected" && <p className="text-xs text-emerald-300">Connected</p>}
                {microsoft?.status === "disconnected" && <p className="text-xs text-zinc-400">Not connected</p>}
              </div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-zinc-400">
            Connect your Microsoft 365 account to discover SaaS applications, monitor user activity, and ensure compliance with organizational policies.
          </p>
          <div className="mt-4 flex gap-2">
            {microsoft?.status === "connected" ? (
              <>
                <GhostButton onClick={() => setManage(true)}>Manage</GhostButton>
                <GhostButton onClick={() => run("reconnect", "/api/integrations/microsoft/connect")}>Reconnect</GhostButton>
              </>
            ) : (
              <PrimaryButton onClick={() => setManage(true)}>Connect</PrimaryButton>
            )}
          </div>
        </article>
        <article className="rounded-2xl border border-white/10 bg-[#14151c] p-5 opacity-70">
          <h2 className="font-semibold blur-[2px]">{other?.name || "Additional provider"}</h2>
          <p className="mt-4 text-sm text-zinc-500 blur-[2px]">A second directory connector is not available yet.</p>
          <button disabled className="mt-6 rounded-xl bg-[#2a2c36] px-4 py-2 text-sm text-zinc-300">
            Coming Soon
          </button>
        </article>
      </div>

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#14151c] p-5">
        <h2 className="text-lg font-semibold">Discover SaaS Applications</h2>
        <p className="mt-1 text-sm text-zinc-400">Scan your Microsoft 365 environment to discover all SaaS applications that users have authorized.</p>
        <PrimaryButton className="mt-4" disabled={busy === "discover" || microsoft?.status !== "connected"} onClick={() => run("discover", "/api/integrations/discover")}>
          {busy === "discover" ? <><Loader2 size={16} className="animate-spin" /> Discovering...</> : "Discover"}
        </PrimaryButton>
        <p className="mt-3 text-xs text-zinc-500">
          Last discovery: {microsoft?.last_discovery_at ? formatStamp(microsoft.last_discovery_at) : "Never"}
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#14151c] p-5">
        <h2 className="text-lg font-semibold">Why Connect Integrations?</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
          <li><span className="font-medium text-white">Automated Discovery:</span> Automatically discover all SaaS applications that users have authorized.</li>
          <li><span className="font-medium text-white">Compliance Monitoring:</span> Track compliance with regulations like PDPL, GDPR, and internal policies.</li>
          <li><span className="font-medium text-white">Security Insights:</span> Identify shadow IT and assess security risks across your applications.</li>
          <li><span className="font-medium text-white">User Activity:</span> Monitor employee productivity signals and license usage across connected applications.</li>
        </ul>
      </section>

      {manage && (
        <Modal title="Microsoft 365 read-only access" subtitle="OAuth 2.0. No agents. No mailbox content." onClose={() => setManage(false)}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            <li>Directory.Read.All</li>
            <li>Application.Read.All</li>
            <li>User.Read.All</li>
          </ul>
          <p className="mt-3 text-sm text-zinc-400">{microsoft?.detail}</p>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            This build records the connection and runs discovery against the seeded estate. A live Microsoft Graph tenant is not included because the demo did not expose Azure credentials.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            {microsoft?.status === "connected" && (
              <GhostButton onClick={() => run("disconnect", "/api/integrations/microsoft/disconnect")}>Disconnect</GhostButton>
            )}
            <PrimaryButton onClick={() => run("connect", "/api/integrations/microsoft/connect")}>
              {busy === "connect" ? "Authorizing..." : "Authorize read-only access"}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
