/**
 * コメントのスレッド化。表示は 2 階層までにし、孫以降はその直近の親スレッドに畳む
 * （深い入れ子はスマホで読みにくいため）。
 */

export type ThreadInput = {
  id: number;
  parentId: number | null;
  createdAt: string;
};

export type Thread<T extends ThreadInput> = {
  comment: T;
  replies: T[];
};

/** 親が見つからない・自分自身を指すなどの壊れた parentId はトップレベル扱いにする */
export function buildThreads<T extends ThreadInput>(
  comments: readonly T[],
): Thread<T>[] {
  const byId = new Map<number, T>(comments.map((c) => [c.id, c]));

  /** 祖先をたどってトップレベルの id を求める。親が欠けている・循環している場合は自分を根にする */
  const rootIdOf = (comment: T): number => {
    const seen = new Set<number>([comment.id]);
    let current = comment;
    while (current.parentId !== null) {
      const parent = byId.get(current.parentId);
      if (!parent || seen.has(parent.id)) return comment.id;
      seen.add(parent.id);
      current = parent;
    }
    return current.id;
  };

  const threads = new Map<number, Thread<T>>();
  const ordered = [...comments].sort(compareByCreatedAt);

  // 先にトップレベルを並べてからぶら下げると、親より先に返信が来ても順序が崩れない
  for (const comment of ordered) {
    if (rootIdOf(comment) === comment.id)
      threads.set(comment.id, { comment, replies: [] });
  }
  for (const comment of ordered) {
    const rootId = rootIdOf(comment);
    if (rootId === comment.id) continue;
    threads.get(rootId)?.replies.push(comment);
  }

  return [...threads.values()];
}

function compareByCreatedAt<T extends ThreadInput>(a: T, b: T): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

export function countComments<T extends ThreadInput>(
  threads: readonly Thread<T>[],
): number {
  return threads.reduce((acc, t) => acc + 1 + t.replies.length, 0);
}
