import { useEffect, useState } from "react";

export type EventKind = "release" | "premiere" | "fan" | "other";
export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  time?: string | undefined; // HH:MM
  tmdbId?: number | undefined;
  poster?: string | null | undefined;
  remindDays: number; // days before; -1 = none
  notified?: boolean;
};

export const KIND_LABEL: Record<EventKind, string> = {
  release: "Release",
  premiere: "Premiere",
  fan: "Fan screening",
  other: "Event",
};

const KEY = "reel-calendar-events";

export function useEvents() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    try {
      setEvents(JSON.parse(localStorage.getItem(KEY) || "[]"));
    } catch {}
  }, []);
  const save = (next: CalEvent[]) => {
    setEvents(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };
  return { events, save };
}

export const letterboxdUrl = (tmdbId: number) => `https://letterboxd.com/tmdb/${tmdbId}`;

export function reminderTime(e: CalEvent): number | null {
  if (e.remindDays < 0) return null;
  const [h, m] = (e.time || "09:00").split(":").map(Number);
  const d = new Date(e.date + "T00:00:00");
  d.setHours(h ?? 9, m ?? 0);
  d.setDate(d.getDate() - e.remindDays);
  return d.getTime();
}

export function toIcs(e: CalEvent): string {
  const d = e.date.replace(/-/g, "");
  const alarm =
    e.remindDays >= 0
      ? `BEGIN:VALARM\nTRIGGER:-P${e.remindDays}D\nACTION:DISPLAY\nDESCRIPTION:${e.title}\nEND:VALARM\n`
      : "";
  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Reel//EN\nBEGIN:VEVENT\nUID:${e.id}@reel\nDTSTART;VALUE=DATE:${d}\nSUMMARY:${KIND_LABEL[e.kind]}: ${e.title}\n${e.tmdbId ? `URL:${letterboxdUrl(e.tmdbId)}\n` : ""}${alarm}END:VEVENT\nEND:VCALENDAR`;
}
