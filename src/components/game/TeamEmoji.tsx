import { getTeamAnimalSrc } from "@/lib/teamAnimals";

export function TeamEmoji({ emoji, color }: { emoji?: string | null; color?: string }) {
  const src = getTeamAnimalSrc(emoji, color);
  return src
    // Local, already optimized SVG artwork needs no image transformation.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="team-animal-icon" src={src} alt="" draggable={false} width={128} height={128} />
    : <>{emoji}</>;
}
