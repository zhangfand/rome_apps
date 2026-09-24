/**
 * Resolve how a chat utterance refers to a family member: `我`, `老婆`,
 * `我爸`, `妈妈`, an exact name, or a member id. Ambiguous references return
 * candidates instead of guessing, so the chat agent can ask a follow-up.
 */
import { normalizeWidth } from "./text.js";
import type { Relation, Sex } from "./types.js";

export interface MemberRef {
  id: string;
  name: string;
  relation: Relation | string;
  sex?: Sex | null;
}

const RELATION_WORDS: Array<{ words: string[]; relation: Relation; sex?: Sex }> = [
  { words: ["我", "本人", "自己", "我自己", "me", "myself", "self"], relation: "本人" },
  { words: ["老婆", "妻子", "媳妇", "媳妇儿", "太太", "夫人", "爱人", "配偶", "对象", "另一半", "wife", "spouse"], relation: "配偶" },
  { words: ["老公", "丈夫", "先生", "husband"], relation: "配偶" },
  { words: ["爸", "爸爸", "父亲", "老爸", "爹", "老爷子", "dad", "father"], relation: "父亲" },
  { words: ["妈", "妈妈", "母亲", "老妈", "娘", "老太太", "mom", "mother"], relation: "母亲" },
  { words: ["儿子", "闺女", "女儿", "孩子", "小孩", "宝宝", "子女", "娃", "son", "daughter", "kid", "child"], relation: "子女" },
];

/** Relation words that also imply a sex, used to split several 子女. */
const SEX_HINT: Record<string, Sex> = { 儿子: "male", son: "male", 女儿: "female", 闺女: "female", daughter: "female" };

export type ResolveResult =
  | { status: "found"; member: MemberRef; via: "id" | "name" | "relation" | "fuzzy" }
  | { status: "ambiguous"; candidates: MemberRef[]; reason: string }
  | { status: "not_found"; candidates: MemberRef[]; reason: string };

function clean(q: string): string {
  return normalizeWidth(q).trim().toLowerCase().replace(/[\s,，。.!！?？]/g, "");
}

/** Strip possessive prefixes: 我爸 → 爸, 我的老婆 → 老婆, 咱妈 → 妈. */
function stripPossessive(q: string): string {
  const m = q.match(/^(我的|我们家的?|咱们?家?的?|俺的?|我家的?|我)(.+)$/);
  return m && m[2] ? m[2] : q;
}

/** Map a relation word to a relation (and implied sex), or null. */
export function relationFromWord(word: string): { relation: Relation; sex?: Sex } | null {
  const q = clean(word);
  for (const candidate of [q, stripPossessive(q)]) {
    for (const group of RELATION_WORDS) {
      if (group.words.includes(candidate)) return { relation: group.relation, sex: SEX_HINT[candidate] };
    }
  }
  return null;
}

/**
 * Resolve a member reference against the current member list.
 *
 * Order: exact id → exact name → relation word (我/老婆/爸爸…) → unique
 * substring match on the name. Several matches → `ambiguous` with candidates.
 */
export function resolveMember(query: string | null | undefined, members: MemberRef[]): ResolveResult {
  const q = clean(query ?? "");
  if (!q) return { status: "not_found", candidates: members, reason: "未指定家庭成员" };

  const byId = members.find((m) => m.id.toLowerCase() === q);
  if (byId) return { status: "found", member: byId, via: "id" };

  const byName = members.filter((m) => clean(m.name) === q);
  if (byName.length === 1) return { status: "found", member: byName[0], via: "name" };
  if (byName.length > 1) return { status: "ambiguous", candidates: byName, reason: `有 ${byName.length} 位成员都叫“${query}”` };

  const rel = relationFromWord(q);
  if (rel) {
    let pool = members.filter((m) => m.relation === rel.relation);
    if (pool.length > 1 && rel.sex) {
      const bySex = pool.filter((m) => m.sex === rel.sex);
      if (bySex.length > 0) pool = bySex;
    }
    if (pool.length === 1) return { status: "found", member: pool[0], via: "relation" };
    if (pool.length > 1) return { status: "ambiguous", candidates: pool, reason: `有 ${pool.length} 位成员的关系都是“${rel.relation}”` };
    return { status: "not_found", candidates: members, reason: `还没有关系为“${rel.relation}”的成员` };
  }

  // Fuzzy: query inside a name or a name inside the query (≥2 chars to avoid noise).
  const stripped = stripPossessive(q);
  const fuzzy = members.filter((m) => {
    const n = clean(m.name);
    return (stripped.length >= 2 && n.includes(stripped)) || (n.length >= 2 && stripped.includes(n));
  });
  if (fuzzy.length === 1) return { status: "found", member: fuzzy[0], via: "fuzzy" };
  if (fuzzy.length > 1) return { status: "ambiguous", candidates: fuzzy, reason: `“${query}”可能指多位成员` };
  return { status: "not_found", candidates: members, reason: `找不到“${query}”对应的成员` };
}
