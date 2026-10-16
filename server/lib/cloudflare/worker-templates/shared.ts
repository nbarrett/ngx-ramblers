export async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const sigBytes = new Uint8Array(sigBuffer);
  return Array.from(sigBytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function encodeRawMimeBase64(raw: ReadableStream<Uint8Array>): Promise<string> {
  const buf = await new Response(raw).arrayBuffer();
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  const numChunks = Math.ceil(bytes.length / chunkSize);
  const binary = Array.from({ length: numChunks }, (_, i) =>
    String.fromCharCode.apply(null, Array.from(bytes.subarray(i * chunkSize, (i + 1) * chunkSize)))
  ).join("");
  return btoa(binary);
}

export async function signAndPostWebhook(webhookUrl: string, body: string, sharedSecret: string): Promise<Response> {
  const signature = await hmacSign(body, sharedSecret);
  const headers = {
    "Content-Type": "application/json",
    "X-NGX-Signature": signature
  };
  const posted = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body,
    redirect: "manual"
  });
  const location = posted.headers.get("Location");
  const redirected = posted.status === 301 || posted.status === 302 || posted.status === 307 || posted.status === 308;
  if (redirected && location) {
    const nextUrl = new URL(location, webhookUrl).toString();
    return fetch(nextUrl, {
      method: "POST",
      headers,
      body,
      redirect: "manual"
    });
  } else {
    return posted;
  }
}
