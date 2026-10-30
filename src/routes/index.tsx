import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import { searchMovies, type MovieHit } from "@/lib/tmdb.functions";
import {
  useEvents,
  KIND_LABEL,
  letterboxdUrl,
  tgvUrl,
  gscUrl,
  reminderTime,
  toIcs,
  type CalEvent,
  type EventKind,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reel — Movie Release Calendar" },
      { name: "description", content: "Track movie releases, premieres and fan screenings with reminders." },
      { property: "og:title", content: "Reel — Movie Release Calendar" },
      { property: "og:description", content: "Track movie releases, premieres and fan screenings with reminders." },
    ],
  }),
  component: Index,
});

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Index() {
  const { events, save } = useEvents();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(ymd(new Date()));
  const [adding, setAdding] = useState(false);

  // reminder loop (works while the app is open)
  useEffect(() => {
    const tick = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      let changed = false;
      const next = events.map((e) => {
        const t = reminderTime(e);
        if (t && !e.notified && Date.now() >= t) {
          new Notification(`${KIND_LABEL[e.kind]}: ${e.title}`, { body: `On ${e.date}`, ...(e.poster ? { icon: e.poster } : {}) });
          changed = true;
          return { ...e, notified: true };
        }
        return e;
      });
      if (changed) save(next);
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [events]);

  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((month.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const byDate = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    events.forEach((e) => (m[e.date] ||= []).push(e));
    return m;
  }, [events]);

  const today = ymd(new Date());
  const dayEvents = byDate[selected] ?? [];
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tight">Reel</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ Add</button>
      </header>

      <section className="surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <h2 className="font-display text-lg">{month.toLocaleString(undefined, { month: "long", year: "numeric" })}</h2>
          <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="pb-2">{d}</div>)}
          {days.map((d) => {
            const k = ymd(d);
            const evs = byDate[k] ?? [];
            const out = d.getMonth() !== month.getMonth();
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`day ${out ? "opacity-30" : ""} ${k === selected ? "day-selected" : ""} ${k === today ? "day-today" : ""}`}
              >
                <span>{d.getDate()}</span>
                <span className="flex gap-0.5">
                  {evs.slice(0, 3).map((e) => <i key={e.id} className={`dot dot-${e.kind}`} />)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm text-muted-foreground">
          {new Date(selected + "T00:00").toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </h3>
        {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">Nothing on this day.</p>}
        <div className="space-y-2">
          {dayEvents.map((e) => <EventRow key={e.id} e={e} onDelete={() => save(events.filter((x) => x.id !== e.id))} onBell={() => save(events.map((x) => x.id === e.id ? { ...x, remindDays: x.remindDays >= 0 ? -1 : 1, notified: false } : x))} />)}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm text-muted-foreground">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.map((e) => <EventRow key={e.id} e={e} showDate onDelete={() => save(events.filter((x) => x.id !== e.id))} onBell={() => save(events.map((x) => x.id === e.id ? { ...x, remindDays: x.remindDays >= 0 ? -1 : 1, notified: false } : x))} />)}
          </div>
        </section>
      )}

      {adding && (
        <AddSheet
          defaultDate={selected}
          onClose={() => setAdding(false)}
          onAdd={(list) => {
            save([...events, ...list]);
            setAdding(false);
            if (list[0]) setSelected(list[0].date);
          }}
        />
      )}
    </main>
  );
}

const shortDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function EventRow({ e, onDelete, onBell, showDate }: { e: CalEvent; onDelete: () => void; onBell: () => void; showDate?: boolean }) {
  const ics = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toIcs(e)], { type: "text/calendar" }));
    a.download = `${e.title}.ics`;
    a.click();
  };
  const on = e.remindDays >= 0;
  return (
    <div className="surface flex items-start gap-3 p-3">
      {e.poster ? <img src={e.poster} alt="" className="h-16 w-11 shrink-0 rounded object-cover" /> : <div className="h-16 w-11 shrink-0 rounded bg-muted" />}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 break-words font-medium leading-snug">{e.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className={`dot dot-${e.kind}`} /> {KIND_LABEL[e.kind]}</span>
          {showDate && <span>{shortDate(e.date)}</span>}
          {e.time && <span>{e.time}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {e.tmdbId && <a className="btn-ghost text-xs" href={letterboxdUrl(e.tmdbId)} target="_blank" rel="noreferrer">Letterboxd</a>}
          <details className="relative">
            <summary className="btn-ghost flex cursor-pointer list-none items-center gap-1 text-xs">Cinemas <ChevronDown size={12} /></summary>
            <div className="surface absolute left-0 z-10 mt-1 flex w-28 flex-col p-1">
              <a className="btn-ghost text-xs" href={tgvUrl(e.title)} target="_blank" rel="noreferrer">TGV</a>
              <a className="btn-ghost text-xs" href={gscUrl(e.title)} target="_blank" rel="noreferrer">GSC</a>
            </div>
          </details>
          <button className="btn-ghost text-xs" onClick={ics}>.ics</button>
          <button className="btn-ghost text-xs" onClick={onDelete} aria-label="Delete">✕</button>
        </div>
      </div>
      <button className={`btn-ghost shrink-0 ${on ? "text-primary" : ""}`} onClick={onBell} aria-label={on ? "Reminder on" : "Reminder off"} title={on ? `${e.remindDays}d before` : "No reminder"}>
        <Bell size={18} fill={on ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function AddSheet({ defaultDate, onClose, onAdd }: { defaultDate: string; onClose: () => void; onAdd: (e: CalEvent[]) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MovieHit[]>([]);
  const [err, setErr] = useState<string | undefined>();
  const [movie, setMovie] = useState<MovieHit | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EventKind>("release");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [remind, setRemind] = useState(1);

  useEffect(() => {
    if (q.length < 2) return setHits([]);
    const t = setTimeout(async () => {
      const r = await searchMovies({ data: { q } });
      setHits(r.results);
      setErr(r.error);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (m: MovieHit) => {
    setMovie(m);
    setTitle(m.title);
    if (m.release_date) setDate(m.release_date);
    setHits([]);
    setQ("");
  };

  const submit = async () => {
    if (!title || !date) return;
    if (remind >= 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    onAdd([{ id: crypto.randomUUID(), title, kind, date, time: time || undefined, tmdbId: movie?.id, poster: movie?.poster, remindDays: remind }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay md:items-center" onClick={onClose}>
      <div className="surface max-h-[90vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display mb-4 text-lg">Add to calendar</h2>

        <label className="field-label">Search movie (Malaysia release dates)</label>
        <input className="field" placeholder="e.g. Dune" value={q} onChange={(e) => setQ(e.target.value)} />
        {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
        {hits.length > 0 && (
          <div className="mt-2 space-y-1">
            {hits.map((m) => (
              <button key={m.id} onClick={() => pick(m)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
                {m.poster ? <img src={m.poster} alt="" className="h-12 w-8 rounded object-cover" /> : <div className="h-12 w-8 rounded bg-muted" />}
                <div className="text-sm">{m.title} <span className="text-muted-foreground">{m.release_date?.slice(0, 4)}</span></div>
              </button>
            ))}
          </div>
        )}

        {movie && (
          <div className="mt-3 flex gap-3 rounded-md bg-muted p-3">
            {movie.poster && <img src={movie.poster} alt="" className="h-20 w-14 rounded object-cover" />}
            <div className="min-w-0 text-xs text-muted-foreground">
              <p className="line-clamp-3">{movie.overview}</p>
              <a className="mt-1 inline-block text-primary" href={letterboxdUrl(movie.id)} target="_blank" rel="noreferrer">Open on Letterboxd ↗</a>
            </div>
          </div>
        )}

        <label className="field-label">Title</label>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="field-label">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`chip ${kind === k ? "chip-on" : ""}`}>
              <i className={`dot dot-${k}`} /> {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="field-label">Date</label><input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="field-label">Time</label><input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>

        <label className="field-label">Reminder</label>
        <select className="field" value={remind} onChange={(e) => setRemind(Number(e.target.value))}>
          <option value={-1}>None</option>
          <option value={0}>Same day</option>
          <option value={1}>1 day before</option>
          <option value={3}>3 days before</option>
          <option value={7}>1 week before</option>
        </select>

        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  );
}
