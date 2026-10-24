import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface StalenessBannerProps {
  isStale: boolean;
  daysAgo: number;
  onSyncClick: () => void;
  language: 'en' | 'bm';
}

export const StalenessBanner: React.FC<StalenessBannerProps> = ({
  isStale,
  daysAgo,
  onSyncClick,
  language,
}) => {
  if (!isStale) return null;
  const isBM = language === 'bm';

  return (
    <div className="bg-[#FEF3C7] text-[#1C3F35] px-4 sm:px-6 py-3 text-sm sm:text-base font-medium flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#1C3F35]">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-6 h-6 rounded-[3px] bg-[#E5A842] border border-[#1C3F35] flex items-center justify-center shrink-0 shadow-[1px_1px_0_#1C3F35]">
          <AlertTriangle className="w-4 h-4 text-[#1C3F35]" />
        </div>
        <span className="text-sm sm:text-base text-[#1C3F35] leading-relaxed">
          <strong className="font-bold text-[#1C3F35]">{isBM ? 'Perhatian Status Dasar:' : 'Policy Staleness Notice:'}</strong>{' '}
          {isBM
            ? 'Pek dasar ini menggunakan data demo setempat dan belum disahkan melalui penyelarasan rasmi secara langsung.'
            : 'This policy pack uses local demo fixtures and has not been verified through a live official-source sync.'}
        </span>
      </div>

      <button
        onClick={onSyncClick}
        className="h-8 sm:h-9 px-3.5 sm:px-4 bg-[#1C3F35] hover:bg-[#285443] text-white rounded-[4px] border border-[#1C3F35] shadow-[2px_2px_0_#1C3F35] active:translate-x-[1px] active:translate-y-[1px] text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer"
      >
        <ArrowRight className="w-3.5 h-3.5 text-[#E5A842]" />
        <span>{isBM ? 'Lihat Status Sumber' : 'View Source Status'}</span>
      </button>
    </div>
  );
};
