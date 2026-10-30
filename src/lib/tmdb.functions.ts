import { createServerFn } from "@tanstack/react-start";

export type MovieHit = {
  id: number;
  title: string;
  release_date: string;
  poster: string | null;
  overview: string;
};

export type MovieDetails = { directors: string[]; myRelease: string | null };

function tmdb(path: string, params: Record<string, string>) {
  const key = process.env["TMDB_API_KEY"]!;
  const isBearer = key.length > 40;
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (!isBearer) url.searchParams.set("api_key", key);
  return fetch(url, { headers: isBearer ? { Authorization: `Bearer ${key}` } : {} });
}

const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").map((w) => (/^\d+$/.test(w) && NUM[+w] ? NUM[+w] : w)).join(" ")
    .replace(/\bpart /g, "");
const grams = (s: string) => {
  const t = ` ${s} `;
  const g: string[] = [];
  for (let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2));
  return g;
};
function similarity(a: string, b: string) {
  const A = grams(a), B = grams(b);
  const pool = [...B];
  let hit = 0;
  for (const g of A) {
    const i = pool.indexOf(g);
    if (i >= 0) { hit++; pool.splice(i, 1); }
  }
  return (2 * hit) / (A.length + B.length || 1);
}

function variants(q: string): string[] {
  const words = q.toLowerCase().replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>([q]);
  const numFixed = words.map((w) => (/^\d+$/.test(w) && NUM[+w] ? `part ${NUM[+w]}` : w)).join(" ");
  out.add(numFixed);
  const noNum = words.filter((w) => !/^\d+$/.test(w)).join(" ");
  if (noNum) out.add(noNum);
  if (words.length > 1) words.forEach((_, i) => out.add(words.filter((__, j) => j !== i).join(" ")));
  words.filter((w) => w.length >= 4 && !/^\d+$/.test(w)).forEach((w) => out.add(w));
  return [...out].filter(Boolean).slice(0, 8);
}

export const searchMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").slice(0, 100) }))
  .handler(async ({ data }): Promise<{ results: MovieHit[]; error?: string | undefined }> => {
    if (!process.env["TMDB_API_KEY"]) return { results: [], error: "Movie search isn't set up yet." };
    const q = data.q.trim();
    if (!q) return { results: [] };
    const lists = await Promise.all(
      variants(q).map(async (v) => {
        const r = await tmdb("/search/movie", { query: v, region: "MY" });
        return r.ok ? (((await r.json()) as { results: any[] }).results ?? []) : [];
      }),
    );
    const seen = new Map<number, any>();
    lists.flat().forEach((m) => seen.has(m.id) || seen.set(m.id, m));
    const nq = norm(q);
    const ranked = [...seen.values()]
      .map((m) => ({ m, s: similarity(nq, norm(m.title)) + Math.min(m.popularity ?? 0, 100) / 400 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    return {
      results: ranked.map(({ m }) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date ?? "",
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        overview: m.overview ?? "",
      })),
    };
  });

export const getMovieDetails = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => ({ id: Number(d.id) }))
  .handler(async ({ data }): Promise<MovieDetails> => {
    if (!process.env["TMDB_API_KEY"]) return { directors: [], myRelease: null };
    const r = await tmdb(`/movie/${data.id}`, { append_to_response: "credits,release_dates" });
    if (!r.ok) return { directors: [], myRelease: null };
    const j = (await r.json()) as any;
    const directors = (j.credits?.crew ?? []).filter((c: any) => c.job === "Director").map((c: any) => c.name as string);
    const my = (j.release_dates?.results ?? []).find((x: any) => x.iso_3166_1 === "MY");
    const theatrical = my?.release_dates?.find((x: any) => x.type === 3) ?? my?.release_dates?.[0];
    return { directors, myRelease: theatrical?.release_date ? String(theatrical.release_date).slice(0, 10) : null };
  });
