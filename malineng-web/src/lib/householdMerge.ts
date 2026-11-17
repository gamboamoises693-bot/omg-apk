import type { Household, HouseholdMember } from "./types";

/** Lower case, no accents or extra spaces, so "JUAN  dela Cruz" and "Juan Dela Cruz" match. */
export function normName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export interface DuplicateGroup {
  households: Household[];
  /** Why they look like the same family, in Tagalog, for the admin. */
  reasons: string[];
}

/**
 * Households that probably describe the same family: the head of one is listed in the other (the typical
 * "both spouses made a household"), or they share the same address in the same purok, or two or more of their members have the same name.
 */
export function findDuplicateGroups(all: Household[]): DuplicateGroup[] {
  const hs = all.filter((h) => !!h.headName);
  const parent = new Map<string, string>(hs.map((h) => [h.id, h.id]));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const reasons = new Map<string, Set<string>>();
  const link = (a: Household, b: Household, why: string) => {
    const ra = find(a.id);
    const rb = find(b.id);
    if (ra !== rb) parent.set(ra, rb);
    for (const id of [a.id, b.id]) {
      if (!reasons.has(id)) reasons.set(id, new Set());
      reasons.get(id)!.add(why);
    }
  };
  for (let i = 0; i < hs.length; i++) {
    for (let j = i + 1; j < hs.length; j++) {
      const a = hs[i];
      const b = hs[j];
      if (a.purok !== b.purok) continue;
      const an = normName(a.headName);
      const bn = normName(b.headName);
      const aMembers = new Set(a.members.map((m) => normName(m.name)));
      const bMembers = new Set(b.members.map((m) => normName(m.name)));
      if (bMembers.has(an) || aMembers.has(bn)) link(a, b, "Nakalista ang puno ng isa sa isa pang household");
      const addr = normName(a.address);
      if (addr.length >= 4 && addr === normName(b.address)) link(a, b, "Parehong address");
      let same = 0;
      aMembers.forEach((n) => { if (n && bMembers.has(n)) same++; });
      if (same >= 2) link(a, b, "Parehong mga miyembro");
    }
  }
  const groups = new Map<string, Household[]>();
  for (const h of hs) {
    if (!reasons.has(h.id)) continue;
    const r = find(h.id);
    groups.set(r, [...(groups.get(r) ?? []), h]);
  }
  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ households: g, reasons: [...new Set(g.flatMap((h) => [...(reasons.get(h.id) ?? [])]))] }));
}

/**
 * The household that results from merging `others` into `keep`: everyone once, nobody listed as their own head,
 * and the other heads become co-heads (so they can still edit it) instead of members.
 */
export function mergeHouseholds(keep: Household, others: Household[]): { members: HouseholdMember[]; coHeadIds: string[]; coHeadNames: string[] } {
  const headNames = new Set([keep.headName, ...others.map((o) => o.headName)].map(normName));
  const seen = new Set<string>();
  const members: HouseholdMember[] = [];
  for (const m of [...keep.members, ...others.flatMap((o) => o.members)]) {
    const n = normName(m.name);
    if (!n || seen.has(n) || headNames.has(n)) continue; // heads are not members
    seen.add(n);
    members.push(m);
  }
  return {
    members: members.slice(0, 20),
    coHeadIds: [...new Set([...(keep.coHeadIds ?? []), ...others.map((o) => o.id)])].slice(0, 3),
    coHeadNames: [...new Set([...(keep.coHeadNames ?? []), ...others.map((o) => o.headName)])].slice(0, 3),
  };
}
