import { OFFLINE_AFTER_MS } from "./limits";

/** 最後の受信から OFFLINE_AFTER_MS 以内ならオンライン。一度も受信していなければオフライン */
export function isOnline(lastSeenAt: string | null, now: Date): boolean {
  if (!lastSeenAt) return false;
  return now.getTime() - new Date(lastSeenAt).getTime() <= OFFLINE_AFTER_MS;
}
