import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useRefresh } from "../components/Shell";
import { Banner, GhostButton, PrimaryButton } from "../components/ui";

type Message = { id: number; role: "user" | "assistant"; content: string };

const prompts = [
  "Which applications have the worst PDPL residency findings?",
  "Summarize the open compliance issues.",
  "What should we fix first for jisr.net?",
];

export function Assistant() {
  const { tick } = useRefresh();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ messages: Message[] }>("/api/assistant/messages")
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the assistant."));
  }, [tick]);

  async function send(content: string) {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    setDraft("");
    try {
      const data = await api<{ messages: Message[] }>("/api/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Groq could not answer.");
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">AI Assistant</h1>
          <p className="mt-1 text-sm text-zinc-400">Ask about the connected SaaS estate. Answers come from Groq using the current evidence.</p>
        </div>
        <GhostButton
          onClick={() =>
            api<{ messages: Message[] }>("/api/assistant/messages", { method: "DELETE" })
              .then((data) => setMessages(data.messages))
              .catch((err) => setError(err.message))
          }
        >
          Clear
        </GhostButton>
      </div>
      <Banner message={error} />
      <div className="mt-4 flex-1 space-y-3">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#14151c] p-5">
            <p className="text-sm text-zinc-300">Ask about SaaS waste, PDPL gaps, or a specific application.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button key={prompt} className="rounded-full border border-white/10 px-3 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/5" onClick={() => void send(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`max-w-3xl rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "ml-auto bg-[#6d5ef8]/20" : "bg-[#14151c] border border-white/10"}`}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </article>
        ))}
        {busy && <p className="text-sm text-zinc-400">Groq is writing a reply...</p>}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <textarea
          className="field h-20 flex-1 py-2"
          placeholder="Ask about a control, an application, or the estate"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(draft);
            }
          }}
        />
        <PrimaryButton disabled={busy || !draft.trim()}>Send</PrimaryButton>
      </form>
    </div>
  );
}
