export function DirectionTag({ direction }: { direction: 1 | -1 }) {
  const isLong = direction === 1;
  return (
    <span className={isLong ? "text-long" : "text-short"}>
      {isLong ? "long" : "short"}
    </span>
  );
}
