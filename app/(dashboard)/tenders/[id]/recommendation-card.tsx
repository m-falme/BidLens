export function RecommendationCard({
  because,
  approval,
  reason,
}: {
  because: readonly string[];
  approval: string | null;
  reason: string | null;
}) {
  if (because.length === 0 && !approval) return null;
  return (
    <div className="flex flex-col gap-3 px-5 pb-4">
      {because.length > 0 && (
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {because.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {approval && <p>{approval}</p>}
      {approval && reason && <p>{reason}</p>}
    </div>
  );
}
