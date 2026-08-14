import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";

interface Props {
  step: number;
  total: number;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  submitting?: boolean;
}

export function WizardActionBar({
  step, total, onBack, onNext, onSubmit, submitting = false,
  backLabel = "Retour", nextLabel = "Continuer", submitLabel = "Envoyer",
}: Props) {
  const isLast = step >= total - 1;
  return (
    <div className="sticky bottom-0 -mx-4 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-b-2xl">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={step === 0 || submitting}>
          <ArrowLeft className="mr-1 h-4 w-4" /> {backLabel}
        </Button>
        {isLast ? (
          <Button type="button" onClick={onSubmit} disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Send className="mr-1 h-4 w-4" /> {submitLabel}
          </Button>
        ) : (
          <Button type="button" onClick={onNext} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {nextLabel} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
