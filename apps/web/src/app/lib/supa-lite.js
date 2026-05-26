import { SUPABASE_ANON, SUPABASE_URL, hasSupabasePublicEnv } from "../config/platform";

function ensureConfigured() {
  if (hasSupabasePublicEnv()) return true;
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON in frontend environment.");
  return false;
}

function saveSession(session) {
  try { localStorage.setItem("sb_session", JSON.stringify(session)); } catch (_) {}
}

export function clearSession() {
  try { localStorage.removeItem("sb_session"); } catch (_) {}
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
    this._mutation = null;
    this._execution = null;
  }

  select(cols) {
    this._select = cols;
    return this;
  }

  eq(col, val) {
    this._filters.push(`${col}=eq.${encodeURIComponent(val)}`);
    return this;
  }

  single() {
    this._single = true;
    return this.execute();
  }

  insert(payload) {
    this._mutation = { method: "POST", payload };
    return this;
  }

  update(payload) {
    this._mutation = { method: "PATCH", payload };
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

  async _execute() {
    if (this._mutation) {
      return this._mutate(this._mutation.method, this._mutation.payload);
    }
    
    if (!ensureConfigured()) {
      return { data: null, error: { message: "Supabase environment is not configured." } };
    }
    const query = [`select=${encodeURIComponent(this._select)}`, ...this._filters].join("&");
    const res = await fetch(`${this._url}/rest/v1/${this._table}?${query}`, {
      headers: {
        "Content-Type": "application/json",
        apikey: this._key,
        Authorization: `Bearer ${this._getToken() ?? this._key}`,
        Prefer: this._single ? "return=representation" : "",
      },
    });

    const data = await res.json();
    if (!res.ok) return { data: null, error: data };

    if (this._single) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }

    return { data, error: null };
  }

  async _mutate(method, payload) {
    if (!ensureConfigured()) {
      return { data: null, error: { message: "Supabase environment is not configured." } };
    }

    const parts = [`select=${encodeURIComponent(this._select)}`, ...this._filters];
    const query = parts.length ? `?${parts.join("&")}` : "";
    const res = await fetch(`${this._url}/rest/v1/${this._table}${query}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this._key,
        Authorization: `Bearer ${this._getToken() ?? this._key}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) return { data: null, error: data };

    if (this._single) {
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

    async getSession() {
      try {
        const saved = localStorage.getItem("sb_session");
        if (saved) {
          const session = JSON.parse(saved);
          supaLite._token = session.access_token;
          return { data: { session }, error: null };
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

        try {
          const ws = new WebSocket(wsUrl);
          ws.onopen = () => {
            statusCb?.("SUBSCRIBED");
            for (const f of this._filters) {
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
                const handler = this._handlers[d.type + JSON.stringify({ schema: d.schema, table: d.table })]
                  ?? this._handlers[d.type]
                  ?? this._handlers["*"];
                handler?.(d);
              }
            } catch (_) {}
          };
          ws.onerror = () => statusCb?.("CHANNEL_ERROR");
          ws.onclose = () => statusCb?.("CLOSED");
          supaLite._channels[name] = ws;
        } catch (_) {
          statusCb?.("CHANNEL_ERROR");
        }
        return this;
      },
    };
    return ch;
  },

  removeChannel(name) {
    const ws = this._channels[name];
    if (ws) {
      try { ws.close(); } catch (_) {}
      delete this._channels[name];
    }
  },
};
