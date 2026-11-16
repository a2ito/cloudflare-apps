import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sampleSchema, type SampleInput } from "../../src/lib/sample-schema";

/**
 * 送れなかった計測の貯めおき。1 行 1 件の JSON Lines。
 *
 * ネットワークが切れている間の計測を失わないよう、送る前に必ずここへ書く。
 * 上限を超えたら古いものから捨てる（1 分ごとなら 5 万件で約 1 か月。それより古い計測はサーバの保存期間を過ぎて捨てられる）。
 */
export const MAX_QUEUED_SAMPLES = 50_000;

export async function loadQueue(file: string): Promise<SampleInput[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`キューのファイルを読めません: ${file}`, { cause: error });
  }
  // 書きかけで落ちたなどで壊れた行は飛ばす（1 行のために全部を失わない）
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      try {
        const parsed = sampleSchema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}

/** 一時ファイルに書いてから置き換える（書いている途中で落ちても前の中身が残るように） */
export async function saveQueue(
  file: string,
  samples: readonly SampleInput[],
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(
    tmp,
    samples.map((s) => JSON.stringify(s)).join("\n") +
      (samples.length > 0 ? "\n" : ""),
    "utf8",
  );
  await rename(tmp, file);
}

/** 上限を超えた分を古い方から捨てる */
export function capQueue<T>(samples: readonly T[], max: number): T[] {
  return samples.length > max
    ? samples.slice(samples.length - max)
    : [...samples];
}
