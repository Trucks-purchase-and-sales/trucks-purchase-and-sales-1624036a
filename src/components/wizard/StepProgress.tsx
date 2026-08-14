interface Props {
  step: number;
  total: number;
  labels?: string[];
}

export function StepProgress({ step, total, labels }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-accent" : "bg-muted"
            }`}
          />
        ))}
      </div>
      {labels && (
        <div className="text-xs font-medium text-muted-foreground">
          Étape {step + 1} sur {total} — {labels[step]}
        </div>
      )}
    </div>
  );
}
