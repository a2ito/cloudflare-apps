import { constants } from "node:fs";
import {
  appendFile,
  chmod,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname } from "node:path";
import { sampleSchema, type SampleInput } from "../../src/lib/sample-schema";

/**
 * 送れなかった計測の貯めおき。1 行 1 件の JSON Lines。
 *
 * ネットワークが切れている間の計測を失わないよう、送る前に必ずここへ書く。
 * 中身はプロセスのメモリにも持ち、ファイルを読むのは起動時だけにする。毎回の書き込みは追記だけで、
 * 送れたときだけ全体を書き直す（オフラインが長くても、SD カードに毎分 10MB を書き直さないように）。
 *
 * SSID と時刻の履歴は居場所の手がかりになるので、ファイルは本人だけが読める権限で作る。
 * 上限を超えたら古いものから捨てる（1 分ごとなら 5 万件で約 1 か月。それより古い計測はサーバの保存期間を過ぎて捨てられる）。
 */
export const MAX_QUEUED_SAMPLES = 50_000;

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

async function ensureDir(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: DIR_MODE });
}

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

/** 1 件を末尾に足す */
export async function appendToQueue(
  file: string,
  sample: SampleInput,
): Promise<void> {
  await ensureDir(file);
  await appendFile(file, JSON.stringify(sample) + "\n", {
    encoding: "utf8",
    mode: FILE_MODE,
  });
}

/** 全体を書き直す。一時ファイルに書いてから置き換える（書いている途中で落ちても前の中身が残るように） */
export async function saveQueue(
  file: string,
  samples: readonly SampleInput[],
): Promise<void> {
  await ensureDir(file);
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(
    tmp,
    samples.map((s) => JSON.stringify(s)).join("\n") +
      (samples.length > 0 ? "\n" : ""),
    { encoding: "utf8", mode: FILE_MODE },
  );
  // 既にあるファイルを置き換えるときも権限をそろえる
  await chmod(tmp, FILE_MODE);
  await rename(tmp, file);
}

/** 上限を超えた分を古い方から捨てる */
export function capQueue<T>(samples: readonly T[], max: number): T[] {
  return samples.length > max
    ? samples.slice(samples.length - max)
    : [...samples];
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    // EPERM は「いるが別ユーザ」。いるものとして扱う
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * 同じキューを使うエージェントが 2 つ動かないようにする（launchd 版と手で動かしたものなど）。
 * 2 つ動くと、読み込みと書き直しが交錯して計測が消える。
 * 前のプロセスが落ちてロックだけ残っているときは、そのプロセスが居なければ取り直す。
 */
export async function acquireLock(file: string): Promise<() => Promise<void>> {
  await ensureDir(file);
  const lock = `${file}.lock`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(
        lock,
        constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY,
        FILE_MODE,
      );
      await handle.writeFile(String(process.pid));
      await handle.close();
      return async () => {
        await unlink(lock).catch(() => undefined);
      };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number.parseInt(
        await readFile(lock, "utf8").catch(() => ""),
        10,
      );
      if (Number.isInteger(pid) && pid > 0 && isAlive(pid)) {
        throw new Error(
          `別のエージェント（pid ${pid}）が同じキューを使っています: ${file}`,
        );
      }
      await unlink(lock).catch(() => undefined);
    }
  }
  throw new Error(`キューのロックを取れません: ${lock}`);
}
