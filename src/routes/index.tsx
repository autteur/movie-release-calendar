import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { searchMovies, getMovieDetails, type MovieHit } from "@/lib/tmdb.functions";
import { useEvents, KIND_LABEL, reminderTime, isUpcoming, isVisible, letterboxdUrl, type CalEvent, type EventKind } from "@/lib/store";
import { EventCard, Sheet } from "@/components/reel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reel — Movie Release Calendar" },
      { name: "description", content: "Track Malaysian movie releases, premieres and fan screenings with reminders." },
      { property: "og:title", content: "Reel — Movie Release Calendar" },
      { property: "og:description", content: "Track Malaysian movie releases, premieres and fan screenings with reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

  useEffect(() => {
    const tick = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      let changed = false;
      const next = events.map((e) => {
        const t = reminderTime(e);
        if (t && !e.notified && !e.watched && Date.now() >= t) {
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

  const today = ymd(new Date());
  const visible = events.filter((e) => isVisible(e, today));

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
    visible.forEach((e) => (m[e.date] ||= []).push(e));
    return m;
  }, [visible]);

  const dayEvents = byDate[selected] ?? [];
  const upcoming = visible.filter((e) => isUpcoming(e, today) && e.date !== selected).sort((a, b) => a.date.localeCompare(b.date));

  const update = (n: CalEvent) => save(events.map((x) => (x.id === n.id ? n : x)));
  const remove = (id: string) => save(events.filter((x) => x.id !== id));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl tracking-tight">Reel</h1>
          <Link to="/diary" className="btn-ghost flex items-center gap-1.5 text-sm"><BookOpen size={16} /> Diary</Link>
        </div>
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
              <button key={k} onClick={() => setSelected(k)} className={`day ${out ? "opacity-30" : ""} ${k === selected ? "day-selected" : ""} ${k === today ? "day-today" : ""}`}>
                <span>{d.getDate()}</span>
                <span className="flex h-1.5 gap-0.5">
                  {evs.slice(0, 3).map((e) => <i key={e.id} className={`dot dot-${e.kind}`} />)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm text-muted-foreground">
          {new Date(selected + "T00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </h3>
        {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">Nothing on this day.</p>}
        <div className="space-y-3">
          {dayEvents.map((e) => <EventCard key={e.id} e={e} onChange={update} onDelete={() => remove(e.id)} />)}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm text-muted-foreground">Upcoming</h3>
          <div className="space-y-3">
            {upcoming.map((e) => <EventCard key={e.id} e={e} onChange={update} onDelete={() => remove(e.id)} />)}
          </div>
        </section>
      )}

      {adding && (
        <AddSheet
          defaultDate={selected}
          onClose={() => setAdding(false)}
          onAdd={(ev) => {
            save([...events, ev]);
            setAdding(false);
            setSelected(ev.date);
            const d = new Date(ev.date + "T00:00");
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
          }}
        />
      )}
    </main>
  );
}

function AddSheet({ defaultDate, onClose, onAdd }: { defaultDate: string; onClose: () => void; onAdd: (e: CalEvent) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<MovieHit[]>([]);
  const [err, setErr] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);
  const [movie, setMovie] = useState<MovieHit | null>(null);
  const [directors, setDirectors] = useState<string[]>([]);
  const [kind, setKind] = useState<EventKind>("release");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [remind, setRemind] = useState(1);

  useEffect(() => {
    if (q.length < 2) return setHits([]);
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchMovies({ data: { q } });
      setHits(r.results);
      setErr(r.error);
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const pick = async (m: MovieHit) => {
    setMovie(m);
    if (m.release_date) setDate(m.release_date);
    setHits([]);
    setQ("");
    const d = await getMovieDetails({ data: { id: m.id } });
    setDirectors(d.directors);
    if (d.myRelease && kind === "release") setDate(d.myRelease);
  };

  const submit = async () => {
    if (!movie || !date) return;
    if (remind >= 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    onAdd({ id: crypto.randomUUID(), title: movie.title, kind, date, time: time || undefined, tmdbId: movie.id, poster: movie.poster, year: movie.release_date?.slice(0, 4), directors, remindDays: remind });
  };

  return (
    <Sheet title="Add to calendar" onClose={onClose}>
      {!movie && (
        <>
          <label className="field-label">Search movie</label>
          <input className="field" autoFocus placeholder="e.g. Dune 3" value={q} onChange={(e) => setQ(e.target.value)} />
          {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
          {searching && <p className="mt-2 text-xs text-muted-foreground">Searching…</p>}
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
        </>
      )}

      {movie && (
        <div className="mt-2 flex gap-3">
          {movie.poster && <img src={movie.poster} alt="" className="poster h-24 w-16" />}
          <div className="min-w-0">
            <div className="font-title text-lg leading-tight">{movie.title}</div>
            {directors.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Directed by {directors.join(", ")}</p>}
            <div className="mt-1 flex gap-3 text-xs">
              <a className="text-primary" href={letterboxdUrl(movie.id)} target="_blank" rel="noreferrer">Letterboxd ↗</a>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => { setMovie(null); setDirectors([]); }}>Change</button>
            </div>
          </div>
        </div>
      )}

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
        <button className="btn-primary flex-1 disabled:opacity-40" disabled={!movie} onClick={submit}>Save</button>
      </div>
    </Sheet>
  );
}
