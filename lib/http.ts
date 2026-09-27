/** CORS headers so the Chrome extension can talk to the local app. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { ...CORS, ...(init.headers ?? {}) } });
}

export function error(message: string, status = 400) {
  return json({ error: message }, { status });
}
