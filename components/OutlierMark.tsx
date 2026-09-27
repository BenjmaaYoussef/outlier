import clsx from "clsx";
import { HEAT_TEXT, formatScore, heat } from "@/lib/format";

/** The big multiplier numeral: how many times the creator's usual performance. */
export function OutlierMark({
  score,
  threshold,
  className,
}: {
  score: number | null;
  threshold: number;
  className?: string;
}) {
  const h = heat(score, threshold);
  return (
    <span className={clsx("multiplier tabular", HEAT_TEXT[h], className)} title={score ? `${score}× this creator's usual` : "No baseline yet"}>
      {formatScore(score)}
    </span>
  );
}
