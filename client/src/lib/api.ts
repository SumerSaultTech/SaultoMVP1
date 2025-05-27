import { queryClient } from "./queryClient";

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  return res;
}

export async function apiRequestJson(
  method: string,
  url: string,
  data?: unknown
): Promise<any> {
  const res = await apiRequest(method, url, data);
  return await res.json();
}
