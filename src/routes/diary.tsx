import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEvents, letterboxdUrl, KIND_LABEL } from "@/lib/store";
import { Stars } from "@/components/reel";

export const Route = createFileRoute("/diary")({
  head: () => ({
    meta: [
      { title: "Diary — Reel" },
      { name: "description", content: "Every movie you've watched in the cinema, where and in which hall." },
      { property: "og:title", content: "Diary — Reel" },
      { property: "og:description", content: "Every movie you've watched in the cinema, where and in which hall." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Diary,
});

function Diary() {
  const { events } = useEvents();
  const watched = events.filter((e) => e.watched).sort((a, b) => b.watched!.date.localeCompare(a.watched!.date));
  const groups: { key: string; label: string; items: typeof watched }[] = [];
  watched.forEach((e) => {
    const key = e.watched!.date.slice(0, 7);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: new Date(key + "-01T00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }), items: [] };
      groups.push(g);
    }
    g.items.push(e);
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 md:py-10">
      <header className="mb-6 flex items-center gap-2">
        <Link to="/" className="btn-ghost" aria-label="Back"><ChevronLeft size={18} /></Link>
        <h1 className="font-display text-2xl tracking-tight">Diary</h1>
        <span className="ml-auto text-sm text-muted-foreground">{watched.length} film{watched.length === 1 ? "" : "s"}</span>
      </header>

      {watched.length === 0 && <p className="text-sm text-muted-foreground">Nothing here yet. Tap the eye on a movie after you've watched it.</p>}

      {groups.map((g) => (
        <section key={g.key} className="mb-8">
          <h2 className="mb-2 border-b pb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</h2>
          <div className="divide-y">
            {g.items.map((e) => {
              const w = e.watched!;
              return (
                <div key={e.id} className="flex items-center gap-4 py-3">
                  <div className="w-8 text-center font-title text-2xl text-muted-foreground">{Number(w.date.slice(8))}</div>
                  {e.poster ? <img src={e.poster} alt="" className="poster h-16 w-11" /> : <div className="poster h-16 w-11 bg-muted" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {e.tmdbId ? <a href={letterboxdUrl(e.tmdbId)} target="_blank" rel="noreferrer" className="font-title text-base hover:text-primary md:text-lg">{e.title}</a> : <span className="font-title text-base md:text-lg">{e.title}</span>}
                      {e.year && <span className="text-sm text-muted-foreground">{e.year}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {[w.chain !== "Other" ? w.chain : "", w.cinema].filter(Boolean).join(" ")}{w.hall ? ` · ${w.hall}` : ""}{e.kind !== "release" ? ` · ${KIND_LABEL[e.kind]}` : ""}
                    </div>
                  </div>
                  {w.rating > 0 && <Stars value={w.rating} size={14} />}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </main>
  );
}
