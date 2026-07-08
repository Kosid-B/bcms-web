import { SUPABASE_ANON, SUPABASE_URL, hasSupabasePublicEnv } from "../config/platform";

function ensureConfigured() {
  if (hasSupabasePublicEnv()) return true;
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON in frontend environment.");
  return false;
}

function saveSession(session) {
  try { sessionStorage.setItem("sb_session", JSON.stringify(session)); } catch (_) {}
}

export function clearSession() {
  try { sessionStorage.removeItem("sb_session"); } catch (_) {}
}

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now() + 30_000; // 30s buffer
  } catch (_) { return true; }
}

class SupaQueryLite {
  constructor(url, key, table, getToken) {
    this._url = url;
    this._key = key;
    this._table = table;
    this._getToken = getToken;
    this._filters = [];
    this._select = "*";
    this._single = false;
    this._maybeSingle = false;
    this._mutation = null;
    this._execution = null;
    this._orderParts = [];
    this._limitVal = null;
    this._countMode = null;
    this._headOnly = false;
  }

  select(cols, options = {}) {
    this._select = cols;
    if (options.count) this._countMode = options.count;
    if (options.head) this._headOnly = true;
    return this;
  }

  eq(col, val) {
    this._filters.push(`${col}=eq.${encodeURIComponent(val)}`);
    return this;
  }

  neq(col, val) {
    this._filters.push(`${col}=neq.${encodeURIComponent(val)}`);
    return this;
  }

  gt(col, val) {
    this._filters.push(`${col}=gt.${encodeURIComponent(val)}`);
    return this;
  }

  gte(col, val) {
    this._filters.push(`${col}=gte.${encodeURIComponent(val)}`);
    return this;
  }

  lt(col, val) {
    this._filters.push(`${col}=lt.${encodeURIComponent(val)}`);
    return this;
  }

  lte(col, val) {
    this._filters.push(`${col}=lte.${encodeURIComponent(val)}`);
    return this;
  }

  order(col, { ascending = true } = {}) {
    this._orderParts.push(`${col}.${ascending ? "asc" : "desc"}`);
    return this;
  }

  limit(n) {
    this._limitVal = n;
    return this;
  }

  single() {
    this._single = true;
    return this.execute();
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this.execute();
  }

  insert(payload) {
    this._mutation = { method: "POST", payload };
    return this;
  }

  upsert(payload, { onConflict } = {}) {
    this._mutation = { method: "POST", payload, upsert: true, onConflict };
    return this;
  }

  update(payload) {
    this._mutation = { method: "PATCH", payload };
    return this;
  }

  delete() {
    this._mutation = { method: "DELETE", payload: null };
    return this;
  }

  execute() {
    if (!this._execution) {
      this._execution = this._execute();
    }
    return this._execution;
  }

  then(onFulfilled, onRejected) {
    return this.execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.execute().catch(onRejected);
  }

  finally(onFinally) {
    return this.execute().finally(onFinally);
  }

  _buildQuery() {
    const parts = [`select=${encodeURIComponent(this._select)}`, ...this._filters];
    if (this._orderParts.length) parts.push(`order=${this._orderParts.join(",")}`);
    if (this._limitVal !== null) parts.push(`limit=${this._limitVal}`);
    return parts.join("&");
  }

  async _fetchRest(token) {
    const query = this._buildQuery();
    const preferParts = [];
    if (this._countMode) preferParts.push(`count=${this._countMode}`);
    if (this._single || this._maybeSingle) preferParts.push("return=representation");
    return fetch(`${this._url}/rest/v1/${this._table}?${query}`, {
      method: this._headOnly ? "HEAD" : "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: this._key,
        Authorization: `Bearer ${token ?? this._key}`,
        ...(preferParts.length ? { Prefer: preferParts.join(",") } : {}),
        ...(this._countMode ? { Accept: "application/json" } : {}),
      },
    });
  }

  async _execute() {
    if (this._mutation) {
      return this._mutate(this._mutation.method, this._mutation.payload);
    }

    if (!ensureConfigured()) {
      return { data: null, count: null, error: { message: "Supabase environment is not configured." } };
    }

    let res = await this._fetchRest(this._getToken());

    // Auto-refresh on 401 and retry once
    if (res.status === 401) {
      const { data: refreshed } = await supaLite.auth.refreshSession();
      if (refreshed?.session) {
        res = await this._fetchRest(supaLite._token);
      }
    }

    // Extract count from Content-Range header (PostgREST pattern)
    const contentRange = res.headers?.get?.("content-range") ?? "";
    let count = null;
    if (contentRange && this._countMode) {
      const match = contentRange.match(/\/(\d+|\*)$/);
      count = match && match[1] !== "*" ? parseInt(match[1], 10) : null;
    }

    if (this._headOnly) return { data: null, count, error: null };

    const data = await res.json();
    if (!res.ok) return { data: null, count: null, error: data };

    if (this._single) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, count, error: null };
    }
    if (this._maybeSingle) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, count, error: null };
    }

    return { data, count, error: null };
  }

  async _fetchMutation(method, payload, token) {
    const filterParts = [...this._filters];
    const queryStr = filterParts.length ? `?${filterParts.join("&")}` : "";
    const preferParts = ["return=representation"];
    if (this._mutation?.upsert) preferParts.push("resolution=merge-duplicates");
    const url = this._mutation?.upsert && this._mutation?.onConflict
      ? `${this._url}/rest/v1/${this._table}?on_conflict=${encodeURIComponent(this._mutation.onConflict)}`
      : `${this._url}/rest/v1/${this._table}${queryStr}`;
    return fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this._key,
        Authorization: `Bearer ${token ?? this._key}`,
        Prefer: preferParts.join(","),
      },
      ...(payload !== null ? { body: JSON.stringify(payload) } : {}),
    });
  }

  async _mutate(method, payload) {
    if (!ensureConfigured()) {
      return { data: null, error: { message: "Supabase environment is not configured." } };
    }

    let res = await this._fetchMutation(method, payload, this._getToken());

    // Auto-refresh on 401 and retry once
    if (res.status === 401) {
      const { data: refreshed } = await supaLite.auth.refreshSession();
      if (refreshed?.session) {
        res = await this._fetchMutation(method, payload, supaLite._token);
      }
    }

    if (method === "DELETE" && res.status === 204) return { data: null, error: null };

    const data = await res.json();
    if (!res.ok) return { data: null, error: data };

    if (this._single || this._maybeSingle) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }

    return { data, error: null };
  }
}

export const supaLite = {
  url: SUPABASE_URL,
  key: SUPABASE_ANON,
  _token: null,

  _headers(extra = {}) {
    return {
      "Content-Type": "application/json",
      apikey: this.key,
      Authorization: `Bearer ${this._token ?? this.key}`,
      ...extra,
    };
  },

  auth: {
    async signOut() {
      if (!ensureConfigured()) return { error: { message: "Supabase environment is not configured." } };
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: "POST",
        headers: supaLite._headers(),
      });
      supaLite._token = null;
      clearSession();
      return { error: null };
    },

    async refreshSession() {
      try {
        const saved = sessionStorage.getItem("sb_session");
        if (!saved) return { data: { session: null }, error: null };
        const session = JSON.parse(saved);
        if (!session.refresh_token) return { data: { session: null }, error: null };

        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        });

        if (!res.ok) {
          // Do NOT clear session on failure — keep existing token as fallback
          return { data: { session: null }, error: { message: "Token refresh failed" } };
        }

        const refreshed = await res.json();
        const merged = { ...session, ...refreshed };
        saveSession(merged);
        supaLite._token = refreshed.access_token;
        return { data: { session: merged }, error: null };
      } catch (_) {
        return { data: { session: null }, error: null };
      }
    },

    async getSession() {
      try {
        const saved = sessionStorage.getItem("sb_session");
        if (saved) {
          const session = JSON.parse(saved);
          if (session.access_token) {
            if (isTokenExpired(session.access_token)) {
              const { data } = await this.refreshSession();
              if (data.session) return { data };
            } else {
              supaLite._token = session.access_token;
              return { data: { session }, error: null };
            }
          }
        }
      } catch (_) {}
      return { data: { session: null }, error: null };
    },

    async getUser() {
      if (!ensureConfigured()) return { data: { user: null }, error: { message: "Not configured" } };
      if (!supaLite._token && !(await this.getSession()).data.session) {
        return { data: { user: null }, error: null };
      }

      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: supaLite._headers(),
      });
      const data = await res.json();
      if (!res.ok) return { data: { user: null }, error: data };
      return { data: { user: data }, error: null };
    },

    async signInWithOAuth({ provider, options = {} }) {
      if (!ensureConfigured()) return { error: { message: "Supabase environment is not configured." } };
      const query = new URLSearchParams({
        provider,
        redirect_to: options.redirectTo || window.location.origin,
      });
      window.location.href = `${SUPABASE_URL}/auth/v1/authorize?${query.toString()}`;
      return { data: null, error: null };
    },

    async handleOAuthCallback() {
      const hash = window.location.hash;
      if (!hash || !hash.includes("access_token")) return null;

      const params = new URLSearchParams(hash.substring(1));
      const session = {
        access_token: params.get("access_token"),
        refresh_token: params.get("refresh_token"),
        expires_in: parseInt(params.get("expires_in") || "3600"),
        token_type: params.get("token_type"),
        user: null, // User info will be fetched by getSession/loadProfile
      };

      if (session.access_token) {
        saveSession(session);
        supaLite._token = session.access_token;
        window.location.hash = "";
        return session;
      }
      return null;
    },
  },

  from(table) {
    return new SupaQueryLite(this.url, this.key, table, () => this._token);
  },

  async rpc(fn, params = {}) {
    if (!ensureConfigured()) {
      return { data: null, error: { message: "Supabase environment is not configured." } };
    }
    const doFetch = (token) => fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.key,
        Authorization: `Bearer ${token ?? this.key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(params),
    });

    let res = await doFetch(this._token);
    if (res.status === 401) {
      const { data: refreshed } = await supaLite.auth.refreshSession();
      if (refreshed?.session) res = await doFetch(supaLite._token);
    }

    const data = await res.json();
    return { data: res.ok ? data : null, error: res.ok ? null : data };
  },

  _channels: {},
  channel(name) {
    const ch = {
      _filters: [],
      _handlers: {},
      on(event, filterOrHandler, handlerOrUndef) {
        if (typeof filterOrHandler === "function") {
          this._handlers[event] = filterOrHandler;
        } else {
          this._filters.push({ event, ...filterOrHandler });
          if (typeof handlerOrUndef === "function") {
            this._handlers[event + JSON.stringify(filterOrHandler)] = handlerOrUndef;
          }
        }
        return this;
      },
      subscribe(statusCb) {
        if (!ensureConfigured()) {
          statusCb?.("CHANNEL_ERROR");
          return this;
        }
        const wsUrl = SUPABASE_URL.replace("https://", "wss://").replace("http://", "ws://")
          + `/realtime/v1/websocket?apikey=${SUPABASE_ANON}`;

        const MAX_RETRIES = 5;
        let retries = 0;

        // sentinel so removeChannel() can signal "stop reconnecting"
        supaLite._channels[name] = { ws: null, active: true };

        const connect = () => {
          const entry = supaLite._channels[name];
          if (!entry?.active) return; // removed or destroyed

          try {
            const ws = new WebSocket(wsUrl);
            entry.ws = ws;

            ws.onopen = () => {
              retries = 0;
              statusCb?.("SUBSCRIBED");
              for (const f of ch._filters) {
                ws.send(JSON.stringify({
                  topic: `realtime:${f.schema ?? "public"}:${f.table ?? "*"}:${f.filter ?? "*"}`,
                  event: "phx_join",
                  payload: { config: { broadcast: { self: false }, postgres_changes: [f] } },
                  ref: "1",
                }));
              }
            };

            ws.onmessage = (e) => {
              try {
                const msg = JSON.parse(e.data);
                if (msg.event === "postgres_changes" && msg.payload?.data) {
                  const d = msg.payload.data;
                  const handler = ch._handlers[d.type + JSON.stringify({ schema: d.schema, table: d.table })]
                    ?? ch._handlers[d.type]
                    ?? ch._handlers["*"];
                  handler?.(d);
                }
              } catch (_) {}
            };

            ws.onerror = () => {};

            ws.onclose = () => {
              const e = supaLite._channels[name];
              if (!e?.active) { statusCb?.("CLOSED"); return; }

              if (retries >= MAX_RETRIES) {
                statusCb?.("CHANNEL_ERROR");
                return;
              }
              const delay = Math.min(1000 * Math.pow(2, retries), 30_000);
              retries++;
              statusCb?.("RECONNECTING");
              setTimeout(connect, delay);
            };
          } catch (_) {
            statusCb?.("CHANNEL_ERROR");
          }
        };

        connect();
        return this;
      },
    };
    return ch;
  },

  removeChannel(name) {
    const entry = this._channels[name];
    if (entry) {
      entry.active = false; // stops pending reconnect timeouts
      try { entry.ws?.close(); } catch (_) {}
      delete this._channels[name];
    }
  },
};
