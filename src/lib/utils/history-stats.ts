/**
 * Groups a URL under the website it belongs to. Web pages group by host, so
 * ports stay distinct and "www." is merged with the bare domain. Other schemes
 * (chrome://, chrome-extension://, file://) keep their scheme to stay
 * recognisable and avoid colliding with web hosts.
 */
export function siteForUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return parsed.host.replace(/^www\./, "");
  }
  if (parsed.protocol === "file:") return "Local files";
  return parsed.host ? `${parsed.protocol}//${parsed.host}` : parsed.protocol;
}
