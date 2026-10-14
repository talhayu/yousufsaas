import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useRefresh } from "../components/Shell";
import { Banner, GhostButton, Modal, PrimaryButton } from "../components/ui";
import type { User } from "../types";

export function Users() {
  const { user } = useAuth();
  const { tick } = useRefresh();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "Compliance Officer", password: "" });

  function load() {
    return api<{ users: User[] }>("/api/users").then((data) => setUsers(data.users));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load users."));
  }, [tick]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      setOpen(false);
      setForm({ name: "", email: "", role: "Compliance Officer", password: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the user.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-zinc-400">People who can sign in to this organization.</p>
        </div>
        {user?.role === "Admin" && <PrimaryButton onClick={() => setOpen(true)}>Add user</PrimaryButton>}
      </div>
      <Banner message={error} />
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#14151c]">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-white/5">
                <td className="px-4 py-3">{item.name}</td>
                <td className="text-zinc-300">{item.email}</td>
                <td>{item.role}</td>
                <td className="pr-4 text-right">
                  {user?.role === "Admin" && item.id !== user.id && (
                    <button
                      className="text-xs text-rose-300"
                      onClick={() =>
                        api(`/api/users/${item.id}`, { method: "DELETE" })
                          .then(load)
                          .catch((err) => setError(err.message))
                      }
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <Modal title="Add user" onClose={() => setOpen(false)}>
          <form onSubmit={create} className="space-y-3">
            <input className="field" required placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <input className="field" required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option>Admin</option>
              <option>Compliance Officer</option>
              <option>Security Analyst</option>
            </select>
            <input className="field" required minLength={8} type="password" placeholder="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <div className="flex justify-end gap-2">
              <GhostButton type="button" onClick={() => setOpen(false)}>Cancel</GhostButton>
              <PrimaryButton>Create</PrimaryButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
