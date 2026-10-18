import React from 'react';
import { ActiveView } from '../types';

interface HeaderNavProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  eventCount: number;
  onResetDemo: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  activeView,
  onSelectView,
  eventCount,
  onResetDemo,
}) => {
  return (
    <header className="border-b border-[#191816] bg-[#FAF8F3] px-4 md:px-8 py-3.5 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Brand & Design Principle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-[#1D4ED8] border border-[#191816]" />
            <div className="w-4 h-4 rounded-full bg-[#D9381E] border border-[#191816]" />
            <div className="w-4 h-4 bg-[#F8E3E3] border border-[#191816]" />
          </div>
          <span className="font-serif-display text-xl sm:text-2xl font-bold tracking-tight text-[#191816]">
            FairSignal
          </span>
          <span className="text-[11px] font-mono-data text-[#6E6A62] border-l border-[#DCD7CB] pl-2.5 hidden md:inline">
            Movement is a signal to ask, not a reason to accuse.
          </span>
        </div>

        {/* The Two Flat Tab Buttons & Reset */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Tab 1: Candidate demo */}
          <button
            type="button"
            onClick={() => onSelectView('candidate')}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all ${
              activeView === 'candidate'
                ? 'bg-[#191816] text-[#FAF8F3] border-[#191816] shadow-[2px_2px_0px_#1D4ED8]'
                : 'bg-white text-[#191816] border-[#191816] hover:bg-[#F8E3E3]'
            }`}
          >
            Candidate demo
          </button>

          {/* Tab 2: Reviewer view */}
          <button
            type="button"
            onClick={() => onSelectView('reviewer')}
            className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
              activeView === 'reviewer'
                ? 'bg-[#191816] text-[#FAF8F3] border-[#191816] shadow-[2px_2px_0px_#D9381E]'
                : 'bg-white text-[#191816] border-[#191816] hover:bg-[#F8E3E3]'
            }`}
          >
            <span>Reviewer view</span>
            <span className="font-mono-data text-[10px] px-1 py-0.2 bg-[#FAF8F3] text-[#191816] border border-[#191816]">
              {eventCount}
            </span>
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={onResetDemo}
            className="px-2.5 py-1.5 text-xs font-mono-data text-[#59564F] hover:text-[#191816] underline ml-1"
            title="Reset demo data to initial state"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
};
