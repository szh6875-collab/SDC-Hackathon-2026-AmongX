import React from 'react';
import { ExternalLink, Presentation } from 'lucide-react';
import { PageHeader } from './common';

interface PitchDeckViewProps { language: 'en' | 'bm'; }
export const PitchDeckView: React.FC<PitchDeckViewProps> = ({ language }) => {
  const isBM = language === 'bm';
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
      <PageHeader tag={isBM ? 'Pembentangan' : 'Presentation'} tagIcon={Presentation} title={isBM ? 'Dek Pitch Orbyte' : 'Orbyte Pitch Deck'} description={isBM ? 'Dek interaktif yang dikekalkan daripada frontend lama. Simulasi dan pemasa hanya untuk pembentangan.' : 'The interactive deck retained from the old frontend. Its simulator and timer are presentation-only.'} secondaryAction={{ label: isBM ? 'Buka tab baharu' : 'Open new tab', icon: ExternalLink, onClick: () => window.open('/legacy/slides.html', '_blank', 'noopener,noreferrer'), variant: 'secondary' }} />
      <div className="min-h-[640px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <iframe title="Orbyte Pitch Deck" src="/legacy/slides.html" className="h-[min(78vh,900px)] w-full border-0" loading="lazy" />
      </div>
    </div>
  );
};
