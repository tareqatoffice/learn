export function isLocalMongoUri(uri: string): boolean {
  const match = uri.trim().match(/^mongodb:\/\/([^/?#]+)/i);
  if (!match) return false;
  const hosts = match[1].slice(match[1].lastIndexOf("@") + 1).split(",");
  return hosts.every((entry) => {
    const host = entry.replace(/:\d*$/, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  });
}
