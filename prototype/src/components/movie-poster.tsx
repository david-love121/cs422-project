"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { imageUrl, type Movie } from "@/lib/tmdb";

export default function MoviePoster({
  movie,
  className = "poster",
  fallbackClassName = "poster-fallback",
  showFallbackTitle = true,
  iconSize = 34,
  lazy = true,
}: {
  movie: Movie;
  className?: string;
  fallbackClassName?: string;
  showFallbackTitle?: boolean;
  iconSize?: number;
  lazy?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = imageUrl(movie.poster_path);
  return (
    <div className={className}>
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={`${movie.title} poster`}
          loading={lazy ? "lazy" : undefined}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className={fallbackClassName || undefined}>
          <Film size={iconSize} />
          {showFallbackTitle && <span>{movie.title}</span>}
        </div>
      )}
    </div>
  );
}
