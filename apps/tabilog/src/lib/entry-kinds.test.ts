import { describe, expect, it } from "vitest";
import {
  ENTRY_KIND_OPTIONS,
  ENTRY_KINDS,
  entryKindEmoji,
  entryKindLabel,
  entryKindName,
  isEntryKind,
} from "./entry-kinds";

describe("記録の種別", () => {
  it("すべての種別にラベルがある", () => {
    expect(ENTRY_KIND_OPTIONS.map((k) => k.value)).toEqual([...ENTRY_KINDS]);
    for (const option of ENTRY_KIND_OPTIONS) expect(option.label).not.toBe("");
  });

  it("「見た」を選べる", () => {
    expect(isEntryKind("sightseeing")).toBe(true);
    expect(entryKindLabel("sightseeing")).toBe("👀 見た");
  });

  it("絵文字だけを見せる場所のために、名前を取り出せる", () => {
    // 一覧は絵文字だけ出すので、読み上げや吹き出しにはこちらを渡す
    expect(entryKindName("food")).toBe("食べた");
    expect(entryKindName("sightseeing")).toBe("見た");
    expect(entryKindName("drink")).toBe("drink");
  });

  it("知らない種別は弾くが、表示では消さない", () => {
    expect(isEntryKind("drink")).toBe(false);
    // 種別を増減した前後でも、保存済みの記録の行が空にならないようにする
    expect(entryKindLabel("drink")).toBe("drink");
  });
});

describe("entryKindEmoji", () => {
  it("種別の絵文字だけを返す", () => {
    expect(entryKindEmoji("food")).toBe("🍜");
    expect(entryKindEmoji("sightseeing")).toBe("👀");
  });

  it("知らない種別でも既定の印を返す（写真の無いカードが空にならない）", () => {
    expect(entryKindEmoji("drink")).toBe("📌");
    expect(entryKindEmoji("")).toBe("📌");
  });
});
