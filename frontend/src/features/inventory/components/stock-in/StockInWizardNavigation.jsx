import { ArrowLeft, ArrowRight, Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { STOCK_IN_STEPS } from "../../hooks/useStockInWizard";

const Kbd = ({ children }) => (
  <kbd className="mx-px rounded border border-b-2 border-slate-300 bg-white px-1.5 py-px font-mono text-[10.5px] font-semibold text-slate-700">{children}</kbd>
);

const StockInWizardNavigation = ({ activeStep, onPrev, onNext, onSaveDraft, isSubmitting, isSavingDraft, nextDisabled }) => {
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === STOCK_IN_STEPS.length - 1;

  return (
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:gap-3 md:static md:bg-transparent md:pb-0 md:pt-6">
      <div className="flex items-center gap-4">
      <Button
        type="button"
        variant="ghost"
        disabled={isFirstStep}
        onClick={onPrev}
        className="gap-1.5 rounded-lg px-2 text-xs sm:px-3 font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
      >
        <ArrowLeft className="size-4" />
        Prev
      </Button>
      {activeStep < 3 && (
        <span className="hidden whitespace-nowrap text-[11.5px] text-slate-500 xl:inline [@media(hover:none)]:hidden">
          <Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd> move between fields · <Kbd>Enter</Kbd> next · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> back
        </span>
      )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={isSavingDraft || isSubmitting}
          className="gap-2 rounded-lg border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          {isSavingDraft && <Loader2 className="size-3.5 animate-spin" />}
          Draft
        </Button>

        <Button
          id="stock-in-next"
          type="button"
          onClick={onNext}
          disabled={isSubmitting || nextDisabled}
          title={nextDisabled ? "Send the tags to the printer first" : undefined}
          className={
            isLastStep
              ? "gap-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-black"
              : "gap-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
          }
        >
          {isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLastStep ? (
            <>
              <span className="sm:hidden">Confirm &amp; Print</span>
              <span className="hidden sm:inline">Confirm Inward &amp; Print Labels</span>
              <Printer className="size-4" />
            </>
          ) : (
            <>
              Next<span className="hidden sm:inline"> Step</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StockInWizardNavigation;
