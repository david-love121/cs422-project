import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMovie, parseSavedMovies } from "../src/lib/movie";

test("saved movie decoding rejects unusable identities", () => {
  for (const value of [
    null, [], "movie", {}, { id: 0, title: "Zero" },
    { id: -1, title: "Negative" }, { id: 1.5, title: "Fraction" },
    { id: Number.MAX_SAFE_INTEGER + 1, title: "Unsafe" },
    { id: "123", title: "String ID" }, { id: 123, title: " " },
  ]) assert.equal(parseMovie(value), null);
});

test("partial legacy metadata receives safe display defaults", () => {
  assert.deepEqual(parseMovie({ id: 123, title: " Legacy title " }), {
    id: 123,
    title: "Legacy title",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    vote_average: 0,
    vote_count: 0,
    popularity: 0,
    genre_ids: [],
    original_language: "",
  });
});

test("malformed saved metadata cannot supply incompatible display or access fields", () => {
  const movie = parseMovie({
    id: 123, title: "Legacy title", overview: { unsafe: true },
    vote_average: "8", vote_count: -1, popularity: Infinity,
    poster_path: "https://example.org/poster.jpg", backdrop_path: "/../private",
    release_date: 2024, original_language: ["en"],
    genre_ids: [16, "35", 16, -1, 1.5], runtime: "85",
    provider_ids: [8, 8, "9", 0], unwanted: "not retained",
  })!;
  assert.equal(movie.overview, "");
  assert.equal(movie.vote_average.toFixed(1), "0.0");
  assert.equal(movie.vote_count, 0);
  assert.equal(movie.popularity, 0);
  assert.equal(movie.poster_path, null);
  assert.equal(movie.backdrop_path, null);
  assert.equal(movie.release_date, "");
  assert.equal(movie.original_language, "");
  assert.deepEqual(movie.genre_ids, [16]);
  assert.deepEqual(movie.provider_ids, [8]);
  assert.equal("runtime" in movie, false);
  assert.equal("unwanted" in movie, false);
});

test("valid stored runtime, artwork, language and genre metadata are preserved", () => {
  const saved = {
    id: 123, title: "A saved movie", overview: "Synopsis", runtime: 85,
    poster_path: "/poster.jpg", backdrop_path: "/backdrop.jpg",
    release_date: "2024-01-01", vote_average: 8, vote_count: 1000,
    popularity: 12.5, genre_ids: [16, 35], original_language: "en",
    provider_ids: [8, 9],
  };
  assert.deepEqual(parseMovie(saved), saved);
  for (const runtime of [0, -1, Infinity, NaN, null]) {
    assert.equal("runtime" in parseMovie({ ...saved, runtime })!, false);
  }
});

test("saved collections retain more than 100 valid titles while dropping duplicates and invalid identities", () => {
  const saved = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1, title: `Saved movie ${index + 1}`,
  }));
  const decoded = parseSavedMovies([...saved, saved[0], null, { id: -1, title: "Invalid" }]);
  assert.equal(decoded.length, 101);
  assert.equal(decoded.at(-1)?.title, "Saved movie 101");
  assert.deepEqual(parseSavedMovies({ results: saved }), []);
});
