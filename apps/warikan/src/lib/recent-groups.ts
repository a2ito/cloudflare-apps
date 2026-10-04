import { z } from "zod";

// 最近開いたグループの一覧。ログインが無いので、グループに戻る手がかりは URL しかない。
// ホーム画面のアイコンからはトップが開くため、開いたグループを端末に覚えておいて並べる。
// 端末の localStorage に置くだけで、サーバには送らない。

export const RECENT_GROUPS_KEY = "warikan:recent-groups";
export const MAX_RECENT_GROUPS = 10;

const recentGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  visitedAt: z.number(),
});

export type RecentGroup = z.infer<typeof recentGroupSchema>;

/** 保存してある JSON を読む。壊れていたら、読める要素だけを残す */
export function parseRecentGroups(raw: string | null): RecentGroup[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item: unknown) => {
    const parsed = recentGroupSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** 開いたグループを先頭に置く。同じグループは名前を新しくして 1 つにまとめる */
export function rememberGroup(
  list: readonly RecentGroup[],
  group: RecentGroup,
): RecentGroup[] {
  return [group, ...list.filter((g) => g.id !== group.id)].slice(
    0,
    MAX_RECENT_GROUPS,
  );
}

/** 一覧からグループを外す */
export function forgetGroup(
  list: readonly RecentGroup[],
  id: string,
): RecentGroup[] {
  return list.filter((g) => g.id !== id);
}

// プライベートブラウズやストレージを禁止した設定では localStorage が例外を投げる。
// 覚えられなくても割り勘はできるので、読み書きの失敗は空の一覧として扱う。

export function loadRecentGroups(): RecentGroup[] {
  try {
    return parseRecentGroups(window.localStorage.getItem(RECENT_GROUPS_KEY));
  } catch (err: unknown) {
    console.warn("最近のグループを読み込めませんでした", err);
    return [];
  }
}

export function saveRecentGroups(list: readonly RecentGroup[]): void {
  try {
    window.localStorage.setItem(RECENT_GROUPS_KEY, JSON.stringify(list));
  } catch (err: unknown) {
    console.warn("最近のグループを保存できませんでした", err);
  }
}
