import React from 'react';
import { Check } from 'lucide-react';

export interface StepItem {
  id: string | number;
  title: string;
  subtitle?: string;
}

interface StepIndicatorProps {
  steps: StepItem[];
  currentStep: number; // 0-based
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) => {
  return (
    <div className={`w-full overflow-x-auto py-2 ${className}`}>
      <ol className="flex items-center w-full min-w-[500px]">
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <li
              key={step.id}
              className={`flex items-center ${isLast ? 'flex-none' : 'flex-1'}`}
            >
              <button
                type="button"
                onClick={() => onStepClick?.(idx)}
                disabled={!onStepClick}
                className={`flex items-center gap-2.5 text-left transition-all ${
                  onStepClick ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                      ? 'bg-[#1C3F35] text-white ring-4 ring-slate-100'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div>
                  <div
                    className={`text-xs font-semibold leading-tight ${
                      isCurrent
                        ? 'text-slate-900 font-bold'
                        : isCompleted
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {step.title}
                  </div>
                  {step.subtitle && (
                    <div className="text-[11px] text-slate-400 leading-none mt-0.5">
                      {step.subtitle}
                    </div>
                  )}
                </div>
              </button>

              {!isLast && (
                <div
                  className={`flex-1 h-0.5 mx-3 transition-colors ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
