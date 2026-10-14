import { createContext, useContext, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  FileText,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "../auth";

const RefreshContext = createContext({ tick: 0, refresh: () => {} });

export function useRefresh() {
  return useContext(RefreshContext);
}

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/applications", label: "Applications", icon: LayoutGrid },
  { to: "/compliance", label: "Compliance", icon: Shield },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/assistant", label: "AI Assistant", icon: MessageCircle },
  { to: "/users", label: "Users", icon: Users },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Shell() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <RefreshContext.Provider value={{ tick, refresh: () => setTick((value) => value + 1) }}>
      <div className="flex min-h-screen bg-[#07080c] text-white">
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-white/8 bg-[#0c0d12]">
          <div className="px-5 py-6">
            <img src="/logo.png" alt="YusrFlow" className="h-9 w-auto" />
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                    isActive ? "bg-[#6d5ef8]/20 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="relative border-t border-white/8 px-3 py-3">
            <div className="mb-2 flex gap-2 px-2">
              <button
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                aria-label="Language"
                onClick={() => setLanguageOpen((open) => !open)}
              >
                <Globe size={16} />
              </button>
              <button
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                aria-label="Refresh"
                onClick={() => setTick((value) => value + 1)}
              >
                <RefreshCw size={16} />
              </button>
            </div>
            {languageOpen && (
              <div className="absolute bottom-24 left-3 z-10 w-52 rounded-xl border border-white/10 bg-[#171820] p-3 text-sm shadow-xl">
                <p className="font-medium">English</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">
                  The application in the demo is English. Arabic is the marketing site, not this console.
                </p>
              </div>
            )}
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
              onClick={() => navigate("/profile")}
            >
              <UserRound size={16} /> Profile
            </button>
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-300 hover:bg-white/5"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-[1280px] px-8 py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </RefreshContext.Provider>
  );
}
