import { cookies } from "next/headers";
import type { SaHealth } from "@/lib/super-admin-portal";

function apiOrigin(): string {
  return process.env.AUTHORITY_API_ORIGIN ?? "http://127.0.0.1:3001";
}

async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

export async function fetchSuperAdminHealth(): Promise<{
  status: number;
  data: SaHealth | null;
}> {
  try {
    const res = await fetch(`${apiOrigin()}/api/super-admin/v1/health`, {
      headers: {
        Accept: "application/json",
        cookie: await cookieHeader(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      return { status: res.status, data: null };
    }
    const data = (await res.json()) as SaHealth;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: null };
  }
}
