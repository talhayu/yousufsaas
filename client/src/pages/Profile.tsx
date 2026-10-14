import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Banner, PrimaryButton } from "../components/ui";

export function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      const data = await api<{ user: NonNullable<typeof user> }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      setUser(data.user);
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the profile.");
    }
  }

  return (
    <form onSubmit={save} className="max-w-xl">
      <h1 className="text-3xl font-semibold">Profile</h1>
      <p className="mt-1 text-sm text-zinc-400">{user?.role}</p>
      <Banner message={error} />
      <label className="mt-5 block text-sm">
        Name
        <input className="field mt-1" required value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="mt-4 block text-sm">
        Email
        <input className="field mt-1" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="mt-4 block text-sm">
        Current password
        <input className="field mt-1" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
      </label>
      <label className="mt-4 block text-sm">
        New password
        <input className="field mt-1" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
      </label>
      <PrimaryButton className="mt-5">Save profile</PrimaryButton>
      {saved && <p className="mt-3 text-sm text-emerald-300">Profile updated.</p>}
    </form>
  );
}
