import { useEffect, useState } from "react";

export type EventKind = "release" | "premiere" | "fan" | "other";
export type Chain = "TGV" | "GSC" | "Other";
export const HALLS = ["Standard", "IMAX", "Deluxe", "Dolby Atmos", "4DX", "ScreenX", "Beanie", "Premiere Class", "Indulge"] as const;

export type Ticket = { time?: string | undefined; chain: Chain; cinema: string; hall: string; seat?: string | undefined };
export type Watched = { date: string; chain: Chain; cinema: string; hall: string; rating: number };

export type CalEvent = {
  id: string;
  title: string;
  kind: EventKind;
  date: string; // YYYY-MM-DD
  time?: string | undefined; // HH:MM
  tmdbId?: number | undefined;
  poster?: string | null | undefined;
  year?: string | undefined;
  directors?: string[] | undefined;
  remindDays: number; // days before; -1 = none
  notified?: boolean;
  ticket?: Ticket | undefined;
  watched?: Watched | undefined;
};

export const KIND_LABEL: Record<EventKind, string> = {
  release: "Release",
  premiere: "Premiere",
  fan: "Fans screening",
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

const DAY = 86400000;
const dayMs = (d: string) => new Date(d + "T00:00:00").getTime();

/** Upcoming banner: not watched, and within 30 days before the date. */
export function isUpcoming(e: CalEvent, today: string) {
  if (e.watched) return false;
  const diff = dayMs(e.date) - dayMs(today);
  return diff >= 0 && diff <= 30 * DAY;
}

/** Unwatched events disappear from view 2 months after their date. */
export function isVisible(e: CalEvent, today: string) {
  if (e.watched) return true;
  return dayMs(today) - dayMs(e.date) <= 60 * DAY;
}

export function reminderTime(e: CalEvent): number | null {
  if (e.remindDays < 0) return null;
  const [h, m] = (e.ticket?.time || e.time || "09:00").split(":").map(Number);
  const d = new Date(e.date + "T00:00:00");
  d.setHours(h ?? 9, m ?? 0);
  d.setDate(d.getDate() - e.remindDays);
  return d.getTime();
}

export function to12h(t?: string) {
  if (!t) return "";
  const [h = 0, m = 0] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "AM" : "PM"}`;
}

export function googleCalUrl(e: CalEvent) {
  const d = e.date.replace(/-/g, "");
  const t = e.ticket?.time || e.time;
  let dates: string;
  if (t) {
    const s = `${d}T${t.replace(":", "")}00`;
    const end = new Date(`${e.date}T${t}:00`);
    end.setHours(end.getHours() + 3);
    const p = (n: number) => String(n).padStart(2, "0");
    dates = `${s}/${end.getFullYear()}${p(end.getMonth() + 1)}${p(end.getDate())}T${p(end.getHours())}${p(end.getMinutes())}00`;
  } else {
    const n = new Date(dayMs(e.date) + DAY);
    const p = (x: number) => String(x).padStart(2, "0");
    dates = `${d}/${n.getFullYear()}${p(n.getMonth() + 1)}${p(n.getDate())}`;
  }
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", `${KIND_LABEL[e.kind]}: ${e.title}`);
  u.searchParams.set("dates", dates);
  u.searchParams.set("ctz", "Asia/Kuala_Lumpur");
  if (e.ticket) u.searchParams.set("location", `${e.ticket.chain} ${e.ticket.cinema}`.trim());
  const det = [e.ticket ? `${e.ticket.hall}${e.ticket.seat ? ` · Seat ${e.ticket.seat}` : ""}` : "", e.tmdbId ? letterboxdUrl(e.tmdbId) : ""].filter(Boolean).join("\n");
  if (det) u.searchParams.set("details", det);
  return u.toString();
}

export const tgvUrl = (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title + " site:tgv.com.my")}`;
export const gscUrl = (title: string) => `https://www.google.com/search?q=${encodeURIComponent(title + " site:gsc.com.my")}`;
