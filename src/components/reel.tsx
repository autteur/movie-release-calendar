import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Eye, MoreHorizontal, Star, Ticket as TicketIcon, CalendarPlus, Trash2 } from "lucide-react";
import {
  KIND_LABEL, HALLS, letterboxdUrl, tgvUrl, gscUrl, googleCalUrl, to12h,
  type CalEvent, type Chain, type Ticket, type Watched,
} from "@/lib/store";

export const longDate = (d: string) => new Date(d + "T00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });

export function EventCard({ e, onChange, onDelete }: { e: CalEvent; onChange: (e: CalEvent) => void; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | "ticket" | "watched">(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const h = (ev: MouseEvent) => !ref.current?.contains(ev.target as Node) && setMenu(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menu]);
  const on = e.remindDays >= 0;
  const t = e.ticket;

  return (
    <div className={`banner banner-${e.kind}`}>
      {e.poster ? <img src={e.poster} alt="" className="poster h-28 w-[4.75rem] md:h-32 md:w-[5.5rem]" /> : <div className="poster h-28 w-[4.75rem] bg-muted md:h-32 md:w-[5.5rem]" />}
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="font-title text-lg leading-tight md:text-2xl">{e.title}</h4>
        {e.directors && e.directors.length > 0 && <p className="mt-1 text-xs text-muted-foreground md:text-sm">Directed by {e.directors.join(", ")}</p>}
        <div className="mt-1.5 flex flex-wrap gap-x-4 text-sm">
          <span>{longDate(e.date)}</span>
          <span className="kind-label">{KIND_LABEL[e.kind]}</span>
        </div>
        {t && (
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm">
            {t.time && <span>{to12h(t.time)}</span>}
            <span>{t.chain !== "Other" ? `${t.chain} ` : ""}{t.cinema}</span>
            {t.hall && <span>{t.hall}</span>}
            {t.seat && <span>{t.seat}</span>}
          </div>
        )}
        {!t && e.time && <div className="mt-1 text-sm">{to12h(e.time)}</div>}
        <div className="mt-auto flex flex-wrap gap-x-5 pt-3 text-sm text-muted-foreground">
          {e.tmdbId && <a className="link-quiet" href={letterboxdUrl(e.tmdbId)} target="_blank" rel="noreferrer">Letterboxd</a>}
          <a className="link-quiet" href={tgvUrl(e.title)} target="_blank" rel="noreferrer">TGV</a>
          <a className="link-quiet" href={gscUrl(e.title)} target="_blank" rel="noreferrer">GSC</a>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center justify-between">
        <button
          className={`icon-btn ${on ? "text-primary" : ""}`}
          onClick={() => onChange({ ...e, remindDays: on ? -1 : 1, notified: false })}
          aria-label={on ? "Reminder on" : "Reminder off"}
          title={on ? `Reminder ${e.remindDays === 0 ? "same day" : `${e.remindDays}d before`}` : "No reminder"}
        >
          {on ? <BellRing size={22} fill="currentColor" /> : <Bell size={22} />}
        </button>
        <button
          className={`icon-btn ${e.watched ? "text-primary" : ""}`}
          onClick={() => setSheet("watched")}
          aria-label="Watched"
          title={e.watched ? "Watched" : "Mark as watched"}
        >
          <Eye size={22} />
        </button>
        <div ref={ref} className="relative">
          <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="More"><MoreHorizontal size={22} /></button>
          {menu && (
            <div className="menu">
              <a className="menu-item" href={googleCalUrl(e)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}><CalendarPlus size={15} /> Add to Google Calendar</a>
              <button className="menu-item" onClick={() => { setMenu(false); setSheet("ticket"); }}><TicketIcon size={15} /> {t ? "Edit ticket" : "I bought a ticket"}</button>
              <button className="menu-item text-destructive" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={15} /> Remove</button>
            </div>
          )}
        </div>
      </div>

      {sheet === "ticket" && (
        <TicketSheet initial={t} defaultTime={e.time} onClose={() => setSheet(null)} onSave={(tk) => { onChange({ ...e, ticket: tk }); setSheet(null); }} onClear={t ? () => { onChange({ ...e, ticket: undefined }); setSheet(null); } : undefined} />
      )}
      {sheet === "watched" && (
        <WatchedSheet e={e} onClose={() => setSheet(null)} onSave={(w) => { onChange({ ...e, watched: w }); setSheet(null); }} onClear={e.watched ? () => { onChange({ ...e, watched: undefined }); setSheet(null); } : undefined} />
      )}
    </div>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-overlay md:items-center" onClick={onClose}>
      <div className="surface max-h-[90vh] w-full max-w-md overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display mb-2 text-lg">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ChainPicker({ value, onChange }: { value: Chain; onChange: (c: Chain) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["TGV", "GSC", "Other"] as Chain[]).map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={`chip justify-center ${value === c ? "chip-on" : ""}`}>{c}</button>
      ))}
    </div>
  );
}

function HallSelect({ value, onChange }: { value: string; onChange: (h: string) => void }) {
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {HALLS.map((h) => <option key={h}>{h}</option>)}
    </select>
  );
}

function TicketSheet({ initial, defaultTime, onClose, onSave, onClear }: { initial?: Ticket | undefined; defaultTime?: string | undefined; onClose: () => void; onSave: (t: Ticket) => void; onClear?: (() => void) | undefined }) {
  const [chain, setChain] = useState<Chain>(initial?.chain ?? "TGV");
  const [cinema, setCinema] = useState(initial?.cinema ?? "");
  const [hall, setHall] = useState(initial?.hall ?? "Standard");
  const [time, setTime] = useState(initial?.time ?? defaultTime ?? "");
  const [seat, setSeat] = useState(initial?.seat ?? "");
  return (
    <Sheet title="Ticket details" onClose={onClose}>
      <label className="field-label">Cinema</label>
      <ChainPicker value={chain} onChange={setChain} />
      <label className="field-label">Location</label>
      <input className="field" placeholder="e.g. Pavilion Damansara" value={cinema} onChange={(e) => setCinema(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <div><label className="field-label">Showtime</label><input type="time" className="field" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <div><label className="field-label">Seat</label><input className="field" placeholder="e.g. F06" value={seat} onChange={(e) => setSeat(e.target.value.toUpperCase())} /></div>
      </div>
      <label className="field-label">Hall</label>
      <HallSelect value={hall} onChange={setHall} />
      <div className="mt-5 flex gap-2">
        {onClear ? <button className="btn-ghost flex-1 text-destructive" onClick={onClear}>Remove ticket</button> : <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>}
        <button className="btn-primary flex-1" disabled={!cinema} onClick={() => onSave({ chain, cinema: cinema.trim(), hall, time: time || undefined, seat: seat.trim() || undefined })}>Save</button>
      </div>
    </Sheet>
  );
}

export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(value === n ? 0 : n)} className={n <= value ? "text-primary" : "text-muted-foreground/40"} aria-label={`${n} stars`}>
          <Star size={size} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function WatchedSheet({ e, onClose, onSave, onClear }: { e: CalEvent; onClose: () => void; onSave: (w: Watched) => void; onClear?: (() => void) | undefined }) {
  const w = e.watched;
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(w?.date ?? (e.date <= today ? e.date : today));
  const [chain, setChain] = useState<Chain>(w?.chain ?? e.ticket?.chain ?? "TGV");
  const [cinema, setCinema] = useState(w?.cinema ?? e.ticket?.cinema ?? "");
  const [hall, setHall] = useState(w?.hall ?? e.ticket?.hall ?? "Standard");
  const [rating, setRating] = useState(w?.rating ?? 0);
  return (
    <Sheet title={`Watched ${e.title}`} onClose={onClose}>
      <label className="field-label">Date watched</label>
      <input type="date" className="field" value={date} onChange={(ev) => setDate(ev.target.value)} />
      <label className="field-label">Where</label>
      <ChainPicker value={chain} onChange={setChain} />
      <label className="field-label">Location</label>
      <input className="field" placeholder="e.g. Mid Valley" value={cinema} onChange={(ev) => setCinema(ev.target.value)} />
      <label className="field-label">Hall</label>
      <HallSelect value={hall} onChange={setHall} />
      <label className="field-label">Rating</label>
      <Stars value={rating} onChange={setRating} />
      <div className="mt-5 flex gap-2">
        {onClear ? <button className="btn-ghost flex-1 text-destructive" onClick={onClear}>Not watched</button> : <button className="btn-ghost flex-1" onClick={onClose}>Cancel</button>}
        <button className="btn-primary flex-1" onClick={() => onSave({ date, chain, cinema: cinema.trim(), hall, rating })}>Add to diary</button>
      </div>
    </Sheet>
  );
}
