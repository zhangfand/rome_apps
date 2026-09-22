import { authorLabel } from "./facts.js";
import type { FactJson } from "./types.js";

export type ActivityOrder = "newest" | "oldest";

export interface ActivityRound {
  stamp: string;
  entries: FactJson[];
}

/** Return a stable time ordering without mutating the API response. */
export function orderActivity(entries: FactJson[], order: ActivityOrder): FactJson[] {
  const direction = order === "oldest" ? 1 : -1;
  return [...entries].sort((left, right) => {
    const byTime = left.createdAt.localeCompare(right.createdAt);
    return direction * (byTime || left.seq - right.seq);
  });
}

/**
 * Keep the Stream's coordinator-bounded rounds intact, then orient both the
 * rounds and their contents to match the selected time order.
 */
export function groupActivityRounds(entries: FactJson[], order: ActivityOrder): ActivityRound[] {
  const groups: ActivityRound[] = [];
  let current: ActivityRound | undefined;

  for (const item of orderActivity(entries, "oldest")) {
    if (!current) {
      current = { stamp: item.createdAt, entries: [] };
      groups.push(current);
    }
    current.entries.push(item);
    if (authorLabel(item.by, item.kind) === "conductor") current = undefined;
  }

  if (order === "oldest") return groups;

  return groups.reverse().map((group) => {
    const reversed = [...group.entries].reverse();
    return { stamp: reversed[0]?.createdAt ?? group.stamp, entries: reversed };
  });
}
