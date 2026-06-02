// Client unifié pour parler à une app distante, soit via Supabase direct, soit via un proxy edge custom (cyounne-agent)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AppConn = {
  id: string;
  name: string;
  connection_mode?: string | null;
  supabase_url?: string | null;
  supabase_anon_key?: string | null;
  service_role_key?: string | null;
  endpoint_url?: string | null;
  endpoint_key?: string | null;
  endpoint_header_name?: string | null;
};

export interface RemoteApp {
  mode: "supabase" | "edge_proxy";
  select(table: string, opts?: { filters?: Record<string, any>; limit?: number }): Promise<{ data: any[]; error?: string }>;
  insert(table: string, row: any): Promise<{ data?: any; error?: string }>;
  update(table: string, match: Record<string, any>, patch: any): Promise<{ error?: string }>;
  listTables(): Promise<string[]>;
  ping(): Promise<{ ok: boolean; info?: any; error?: string }>;
}

export function buildRemote(conn: AppConn): RemoteApp {
  if (conn.connection_mode === "edge_proxy" && conn.endpoint_url) {
    return new EdgeProxyClient(conn);
  }
  return new SupabaseDirectClient(conn);
}

class SupabaseDirectClient implements RemoteApp {
  mode = "supabase" as const;
  private client: any;
  constructor(private conn: AppConn) {
    const key = conn.service_role_key || conn.supabase_anon_key || "";
    this.client = createClient(conn.supabase_url || "", key);
  }
  async select(table: string, opts: any = {}) {
    let q = this.client.from(table).select("*");
    for (const [k, v] of Object.entries(opts.filters || {})) q = q.eq(k, v);
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    return { data: data || [], error: error?.message };
  }
  async insert(table: string, row: any) {
    const { data, error } = await this.client.from(table).insert(row).select().maybeSingle();
    return { data, error: error?.message };
  }
  async update(table: string, match: Record<string, any>, patch: any) {
    let q = this.client.from(table).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await q;
    return { error: error?.message };
  }
  async listTables() {
    try {
      const r = await fetch(`${(this.conn.supabase_url || "").replace(/\/$/, "")}/rest/v1/?apikey=${encodeURIComponent(this.conn.supabase_anon_key || "")}`, {
        headers: { apikey: this.conn.supabase_anon_key || "", Accept: "application/openapi+json" },
      });
      if (!r.ok) return [];
      const spec = await r.json();
      return Object.keys(spec?.definitions ?? {});
    } catch { return []; }
  }
  async ping() {
    try {
      const tables = await this.listTables();
      return { ok: tables.length > 0, info: { tables: tables.length } };
    } catch (e) { return { ok: false, error: (e as Error).message }; }
  }
}

class EdgeProxyClient implements RemoteApp {
  mode = "edge_proxy" as const;
  constructor(private conn: AppConn) {}
  private async call(op: string, params: any = {}) {
    const headerName = this.conn.endpoint_header_name || "x-cyounne-key";
    const r = await fetch(this.conn.endpoint_url!, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerName]: this.conn.endpoint_key || "" },
      body: JSON.stringify({ op, ...params }),
    });
    const text = await r.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!r.ok) return { error: json?.error || `HTTP ${r.status}`, data: null };
    return json;
  }
  async select(table: string, opts: any = {}) {
    const res = await this.call("select", { table, ...opts });
    if (res.error) return { data: [], error: res.error };
    return { data: res.data || res.rows || [], error: undefined };
  }
  async insert(table: string, row: any) {
    const res = await this.call("insert", { table, values: row });
    return { data: res.data, error: res.error };
  }
  async update(table: string, match: Record<string, any>, patch: any) {
    const res = await this.call("update", { table, filters: match, values: patch });
    return { error: res.error };
  }
  async describe(table: string) {
    const res = await this.call("describe_table", { table });
    if (res.error) return { columns: [], sample: null };
    return { columns: res.columns || [], sample: res.sample };
  }
  async listTables() {
    const res = await this.call("list_tables", {});
    if (res.error) return [];
    return res.tables || res.data || [];
  }
  async ping() {
    const res = await this.call("ping", {});
    if (res.error) return { ok: false, error: res.error };
    return { ok: true, info: res };
  }
}
