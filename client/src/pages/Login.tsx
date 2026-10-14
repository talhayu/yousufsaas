import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { Modal, PrimaryButton } from "../components/ui";

export function Login() {
  const { user, loading, login } = useAuth();
  const [email, setEmail] = useState("admin@yusrflow.com");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  async function sendReset(event: FormEvent) {
    event.preventDefault();
    setForgotMessage("");
    try {
      const data = await api<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: forgotEmail || email }),
      });
      setForgotMessage(data.message);
    } catch (err) {
      setForgotMessage(err instanceof Error ? err.message : "Could not send a reset.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07080c] px-4">
      <form onSubmit={submit} className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#101117] px-8 py-9 shadow-2xl">
        <img src="/logo.png" alt="YusrFlow" className="mx-auto h-12 w-auto" />
        <h1 className="mt-6 text-center text-2xl font-semibold">Sign In</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">Enter your credentials to access your account</p>

        <label className="mt-6 block text-sm text-zinc-300">
          Email Address
          <input className="field mt-2" type="email" value={email} required onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="mt-4 block text-sm text-zinc-300">
          <span className="flex items-center justify-between">
            Password
            <button type="button" className="text-xs text-[#b7acff]" onClick={() => setForgot(true)}>
              Forgot password?
            </button>
          </span>
          <input className="field mt-2" type="password" value={password} required onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Remember me
        </label>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <PrimaryButton className="mt-5 w-full" disabled={pending || loading}>
          {pending ? "Signing in..." : "Sign In"}
        </PrimaryButton>
        <p className="mt-6 text-center text-xs text-zinc-500">Enterprise compliance management for GCC organizations</p>
        <p className="mt-2 text-center text-xs text-zinc-500">Secure • Compliant • Scalable</p>
        <p className="mt-5 rounded-xl bg-white/5 px-3 py-2 text-center text-xs leading-5 text-zinc-400">
          Pilot access from this build: admin@yusrflow.com / Yusrflow2026!
        </p>
      </form>
      {forgot && (
        <Modal title="Forgot password" subtitle="We will tell you if a reset can be sent." onClose={() => setForgot(false)}>
          <form onSubmit={sendReset} className="space-y-3">
            <input className="field" type="email" required placeholder="Email Address" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} />
            {forgotMessage && <p className="text-sm text-zinc-300">{forgotMessage}</p>}
            <PrimaryButton className="w-full">Send reset link</PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
