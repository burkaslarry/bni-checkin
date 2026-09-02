import {
  createEvent,
  getEventForDate,
} from "../api";

export const eventTitleForChapter = (chapterLabel: string, date: string) =>
  `BNI ${chapterLabel} Regular Meeting ${date}`;

export type KnownEvent = { id: number; name: string; date?: string };

/**
 * Resolve (or create) the event for YYYY-MM-DD.
 * When [knownEvent] is the already-loaded current event for the same date, skip extra API calls.
 */
export async function ensureEventForDate(
  date: string,
  chapterTag: string,
  chapterId: number,
  chapterLabel: string,
  knownEvent?: KnownEvent | null
): Promise<{ id: number; name: string }> {
  if (knownEvent && knownEvent.date === date && knownEvent.id > 0) {
    return { id: knownEvent.id, name: knownEvent.name };
  }

  let event: { id: number; name: string } | null;
  try {
    event = await getEventForDate(date, chapterTag, chapterId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`無法確認活動 ${date}：${msg}`);
  }

  if (!event) {
    await createEvent(
      eventTitleForChapter(chapterLabel, date),
      date,
      "07:00",
      "09:00",
      "06:30",
      "07:05",
      chapterTag,
      chapterId
    );
    try {
      event = await getEventForDate(date, chapterTag, chapterId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`已嘗試建立活動 ${date}，但無法讀取：${msg}`);
    }
    if (!event) {
      throw new Error(`無法建立活動 ${date}`);
    }
  }
  return event;
}
