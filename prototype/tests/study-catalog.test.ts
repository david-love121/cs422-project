import assert from "node:assert/strict";
import { test } from "node:test";
import snapshot from "../src/lib/study-catalog.json";
import { DEMO_LANGUAGES, DEMO_MOVIES, DEMO_PROVIDERS, filterDemoMovies } from "../src/lib/demo";
import { DEFAULT_FILTERS } from "../src/lib/tmdb";

test("the dated study collection supports the documented multilingual and recovery tasks", () => {
  assert.match(snapshot.retrieved_at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(snapshot.region, "US");
  assert.equal(new Set(DEMO_MOVIES.map((movie) => movie.id)).size, DEMO_MOVIES.length);
  assert.equal(snapshot.study_movie_ids.length, 13);
  for (const id of snapshot.study_movie_ids) {
    const movie = DEMO_MOVIES.find((entry) => entry.id === id);
    assert.ok(movie, `Missing study movie ${id}`);
    assert.ok(movie.runtime && movie.runtime > 0);
    assert.ok(movie.overview && movie.release_date);
    assert.ok(Array.isArray(movie.provider_ids));
  }
  assert.ok(DEMO_LANGUAGES.some((language) => language.iso_639_1 === "ta"));
  assert.ok(filterDemoMovies({ ...DEFAULT_FILTERS, language: "ta" }).some((movie) => movie.title === "Maharaja"));
  assert.ok(filterDemoMovies({ ...DEFAULT_FILTERS, language: "hi" }).some((movie) => movie.title === "Jaane Jaan"));
  const supported = new Set(DEMO_PROVIDERS.map((provider) => provider.provider_id));
  const recoveryIds = [346648, 212778, 371645, 501929, 1584, 546554];
  for (const id of recoveryIds) {
    const movie = DEMO_MOVIES.find((entry) => entry.id === id)!;
    assert.ok(movie.provider_ids?.some((provider) => supported.has(provider)), `${movie.title} needs a supported source in the study snapshot`);
  }
});
