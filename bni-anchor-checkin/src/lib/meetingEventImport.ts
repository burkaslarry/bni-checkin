import {
  createEvent,
  getEventForDate,
} from "../api";

export const eventTitleForChapter = (chapterLabel: string, date: string) =>
  `BNI ${chapterLabel} Regular Meeting ${date}`;

export async function ensureEventForDate(
  date: string,
  chapterTag: string,
  chapterId: number,
  chapterLabel: string
): Promise<{ id: number; name: string }> {
  let event = await getEventForDate(date, chapterTag, chapterId);
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
    event = await getEventForDate(date, chapterTag, chapterId);
    if (!event) {
      throw new Error(`無法建立活動 ${date}`);
    }
  }
  return event;
}
