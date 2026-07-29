import { getStoreSettingsRow } from "@/lib/settings";

// Credenciales por franquicia — no van en variables de entorno porque cada
// instalación de este mismo código apunta a su propia instancia de Odoo.
// Se cachean 60s en memoria para no pegarle a la base en cada llamada (los
// endpoints de productos suelen disparar varios executeKw en paralelo), no
// porque haga falta más que eso: el admin las edita muy de vez en cuando.
type OdooCredentials = { url: string; db: string; user: string; apiKey: string };

const CREDENTIALS_TTL_MS = 60_000;
let cachedCredentials: OdooCredentials | null = null;
let cachedAt = 0;

let cachedUid: number | null = null;
let cachedUidFingerprint: string | null = null;

// Se llama desde la acción del admin que guarda la conexión, para que un
// cambio de credenciales se note al toque en vez de esperar hasta 60s.
export function resetOdooCache() {
  cachedCredentials = null;
  cachedAt = 0;
  cachedUid = null;
  cachedUidFingerprint = null;
}

async function getOdooCredentials(): Promise<OdooCredentials> {
  const now = Date.now();
  if (cachedCredentials && now - cachedAt < CREDENTIALS_TTL_MS) return cachedCredentials;

  const settings = await getStoreSettingsRow();
  if (!settings.odooUrl || !settings.odooDb || !settings.odooUser || !settings.odooApiKey) {
    throw new Error("Odoo no está configurado — cargá la conexión en Configuración.");
  }

  cachedCredentials = {
    url: settings.odooUrl,
    db: settings.odooDb,
    user: settings.odooUser,
    apiKey: settings.odooApiKey,
  };
  cachedAt = now;
  return cachedCredentials;
}

async function jsonRpc<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Math.floor(Math.random() * 1_000_000),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Odoo request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Odoo error: ${JSON.stringify(data.error)}`);
  }
  return data.result as T;
}

async function login(creds: OdooCredentials): Promise<number> {
  const fingerprint = `${creds.url}|${creds.db}|${creds.user}|${creds.apiKey}`;
  if (cachedUid !== null && cachedUidFingerprint === fingerprint) return cachedUid;

  const uid = await jsonRpc<number>(creds.url, "common", "login", [creds.db, creds.user, creds.apiKey]);
  if (!uid) throw new Error("Odoo login failed: invalid credentials");

  cachedUid = uid;
  cachedUidFingerprint = fingerprint;
  return uid;
}

export async function executeKw<T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {}
): Promise<T> {
  const creds = await getOdooCredentials();
  const uid = await login(creds);
  return jsonRpc<T>(creds.url, "object", "execute_kw", [creds.db, uid, creds.apiKey, model, method, args, kwargs]);
}
