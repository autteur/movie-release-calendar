import { createServerFn } from "@tanstack/react-start";

export type MovieHit = {
  id: number;
  title: string;
  release_date: string;
  poster: string | null;
  overview: string;
};

export const searchMovies = createServerFn({ method: "GET" })
  .inputValidator((d: { q: string }) => ({ q: String(d.q ?? "").slice(0, 100) }))
  .handler(async ({ data }): Promise<{ results: MovieHit[]; error?: string | undefined }> => {
    const key = process.env["TMDB_API_KEY"];
    if (!key) return { results: [], error: "Movie search isn't set up yet (missing TMDB key)." };
    if (!data.q.trim()) return { results: [] };
    const isBearer = key.length > 40;
    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("query", data.q);
    url.searchParams.set("region", "MY");
    if (!isBearer) url.searchParams.set("api_key", key);
    const res = await fetch(url, {
      headers: isBearer ? { Authorization: `Bearer ${key}` } : {},
    });
    if (!res.ok) return { results: [], error: `Search failed (${res.status})` };
    const json = (await res.json()) as { results: any[] };
    return {
      results: json.results.slice(0, 8).map((m) => ({
        id: m.id,
        title: m.title,
        release_date: m.release_date ?? "",
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
        overview: m.overview ?? "",
      })),
    };
  });
