/** Pure route parsing/building (no SDK runtime), shared by the router and tests. */
export type Route =
  | { name: "overview" }
  | { name: "member"; id: string; tab: string | null }
  | { name: "indicator"; memberId: string; code: string }
  | { name: "reports"; memberId: string | null }
  | { name: "report"; id: string }
  | { name: "upload"; memberId: string | null }
  | { name: "interventions"; memberId: string | null }
  | { name: "notFound"; path: string };

export function parseRoute(path: string): Route {
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c, d] = parts;
  if (parts.length === 0) return { name: "overview" };
  if (a === "members" && b) {
    if (c === "indicators" && d) return { name: "indicator", memberId: b, code: d };
    if (c === "tab" && d) return { name: "member", id: b, tab: d };
    if (!c) return { name: "member", id: b, tab: null };
  }
  if (a === "reports") {
    if (!b) return { name: "reports", memberId: null };
    if (b === "member" && c) return { name: "reports", memberId: c };
    return { name: "report", id: b };
  }
  if (a === "upload") return { name: "upload", memberId: b ?? null };
  if (a === "interventions") return { name: "interventions", memberId: b ?? null };
  return { name: "notFound", path };
}

export const paths = {
  overview: () => "",
  member: (id: string, tab?: string | null) => (tab ? `members/${enc(id)}/tab/${enc(tab)}` : `members/${enc(id)}`),
  indicator: (memberId: string, code: string) => `members/${enc(memberId)}/indicators/${enc(code)}`,
  reports: (memberId?: string | null) => (memberId ? `reports/member/${enc(memberId)}` : "reports"),
  report: (id: string) => `reports/${enc(id)}`,
  upload: (memberId?: string | null) => (memberId ? `upload/${enc(memberId)}` : "upload"),
  interventions: (memberId?: string | null) => (memberId ? `interventions/${enc(memberId)}` : "interventions"),
};

function enc(s: string) {
  return encodeURIComponent(s);
}

