// ===== URL Parameter Parsing =====

export function parseParams() {
  const out = {};
  const sources = [
    location.search || "",
    location.hash && location.hash.includes("?")
      ? location.hash.slice(location.hash.indexOf("?"))
      : ""
  ];
  for (const src of sources) {
    const p = new URLSearchParams(src);
    for (const [k, v] of p.entries()) {
      out[k.toLowerCase()] = v;
    }
  }
  return out;
}

export function getHashParam(key) {
  const match = location.hash.match(new RegExp(`[#&?]${key}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setHashParam(key, value) {
  const params = new URLSearchParams(location.hash.slice(1));
  params.set(key, value);
  location.hash = params.toString();
}
