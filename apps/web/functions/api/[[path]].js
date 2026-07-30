const WORKER_ORIGIN =
  "https://link2stream-api.link2stream.workers.dev";

export async function onRequest(context) {
  const incomingUrl = new URL(context.request.url);

  const workerPath =
    incomingUrl.pathname.replace(/^\/api/, "") || "/";

  const workerUrl = new URL(
    workerPath + incomingUrl.search,
    WORKER_ORIGIN
  );

  const headers = new Headers(context.request.headers);

  headers.delete("host");
  headers.delete("origin");
  headers.delete("referer");

  const requestInit = {
    method: context.request.method,
    headers,
    redirect: "manual",
  };

  if (
    context.request.method !== "GET" &&
    context.request.method !== "HEAD"
  ) {
    requestInit.body = context.request.body;
  }

  const workerResponse = await fetch(
    workerUrl.toString(),
    requestInit
  );

  const responseHeaders = new Headers(
    workerResponse.headers
  );

  responseHeaders.delete("access-control-allow-origin");
  responseHeaders.delete(
    "access-control-allow-credentials"
  );

  return new Response(workerResponse.body, {
    status: workerResponse.status,
    statusText: workerResponse.statusText,
    headers: responseHeaders,
  });
}
