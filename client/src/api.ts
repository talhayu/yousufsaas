export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function token() {
  return localStorage.getItem("yusrflow_token") || sessionStorage.getItem("yusrflow_token") || "";
}

export function saveToken(value: string, remember: boolean) {
  if (remember) {
    localStorage.setItem("yusrflow_token", value);
    sessionStorage.removeItem("yusrflow_token");
  } else {
    sessionStorage.setItem("yusrflow_token", value);
    localStorage.removeItem("yusrflow_token");
  }
}

export function clearToken() {
  localStorage.removeItem("yusrflow_token");
  sessionStorage.removeItem("yusrflow_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401 && !path.startsWith("/api/auth/login")) {
    clearToken();
    if (!window.location.pathname.startsWith("/login")) window.location.assign("/login");
  }
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(response.status, data?.error || "Request failed");
  }
  return data as T;
}

export async function download(path: string, filename: string) {
  const headers = new Headers();
  const current = token();
  if (current) headers.set("Authorization", `Bearer ${current}`);
  const response = await fetch(path, { headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || "Download failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadHtml(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
