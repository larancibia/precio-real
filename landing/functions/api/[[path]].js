const API_ORIGIN = "https://precio-real-api.arancibialuisalejandro.workers.dev";

export async function onRequest(context) {
  const incoming = new URL(context.request.url);
  const upstream = new URL(incoming.pathname + incoming.search, API_ORIGIN);

  const headers = new Headers(context.request.headers);
  headers.set("host", upstream.host);

  const init = {
    method: context.request.method,
    headers,
    body:
      context.request.method === "GET" || context.request.method === "HEAD"
        ? undefined
        : context.request.body,
    redirect: "manual",
  };

  const response = await fetch(upstream.toString(), init);
  const outHeaders = new Headers(response.headers);
  outHeaders.set("Access-Control-Allow-Origin", "*");
  outHeaders.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  outHeaders.set("Access-Control-Allow-Headers", "Content-Type");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}
