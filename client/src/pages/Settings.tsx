import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, PrimaryButton } from "../components/ui";

type SettingsData = { orgName: string; alertOnScan: boolean; residency: string; locale: string };

export function Settings() {
  const { tick } = useRefresh();
  const [form, setForm] = useState<SettingsData | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api<{ settings: SettingsData }>("/api/settings")
      .then((data) => setForm(data.settings))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load settings."));
  }, [tick]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaved(false);
    setError("");
    try {
      const data = await api<{ settings: SettingsData }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ orgName: form.orgName, alertOnScan: form.alertOnScan, locale: form.locale }),
      });
      setForm(data.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  if (!form) return <Banner message={error || "Loading settings..."} />;

  return (
    <form onSubmit={save} className="max-w-xl">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-400">Organization defaults used by scans and reports.</p>
      <Banner message={error} />
      <label className="mt-5 block text-sm">
        Organization name
        <input className="field mt-1" required value={form.orgName} onChange={(event) => setForm({ ...form, orgName: event.target.value })} />
      </label>
      <label className="mt-4 block text-sm">
        Data residency
        <input className="field mt-1" value={form.residency} readOnly />
      </label>
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.alertOnScan} onChange={(event) => setForm({ ...form, alertOnScan: event.target.checked })} />
        Create severe-gap alerts when a scan runs
      </label>
      <label className="mt-4 block text-sm">
        Console language
        <select className="field mt-1" value={form.locale} onChange={(event) => setForm({ ...form, locale: event.target.value })}>
          <option value="en">English</option>
          <option value="ar">Arabic preference (stored, interface remains the English demo)</option>
        </select>
      </label>
      <PrimaryButton className="mt-5">Save settings</PrimaryButton>
      {saved && <p className="mt-3 text-sm text-emerald-300">Settings saved.</p>}
    </form>
  );
}
