import React from 'react';

export const PrivacyFooter: React.FC = () => {
  return (
    <footer className="border-t border-[#191816] bg-[#FAF8F3] px-4 md:px-8 py-5 text-center text-xs text-[#59564F] font-mono-data mt-auto">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#191816]" />
          <span className="text-[#191816] font-semibold">
            FairSignal concept prototype
          </span>
        </div>

        <div className="text-[#191816] font-medium">
          Concept only. Simulated events. No automated decisions.
        </div>

        <div className="text-[11px] text-[#7A766E]">
          Human review layer for remote assessments
        </div>
      </div>
    </footer>
  );
};
