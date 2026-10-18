import React, { useState } from 'react';
import { AssessmentEvent, ReviewerVerdict } from '../types';

interface ReviewerViewProps {
  events: AssessmentEvent[];
  onUpdateEventStatus: (
    eventId: string,
    newStatus: ReviewerVerdict,
    note?: string
  ) => void;
}

export const ReviewerView: React.FC<ReviewerViewProps> = ({
  events,
  onUpdateEventStatus,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  const activeEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleAction = (status: ReviewerVerdict, message: string) => {
    if (!activeEvent) return;
    onUpdateEventStatus(activeEvent.id, status, followUpNote || undefined);
    setConfirmationNotice(message);
    setIsAskingFollowUp(false);
    setFollowUpNote('');
    setTimeout(() => {
      setConfirmationNotice(null);
    }, 4000);
  };

  const getStatusStyle = (status: ReviewerVerdict) => {
    switch (status) {
      case 'Recorded as non-violation':
        return 'text-[#1D4ED8] font-bold';
      case 'Escalated for human review':
        return 'text-[#D9381E] font-bold';
      case 'Follow-up requested':
        return 'text-[#8F3535] font-bold';
      case 'Context received · human review only':
      default:
        return 'text-[#191816] font-medium';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Philosophy */}
      <div className="text-center space-y-1">
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#191816] tracking-tight">
          Reviewer View
        </h1>
        <p className="text-xs sm:text-sm text-[#59564F]">
          Candidate context is reviewed alongside timestamped moments before any determination.
        </p>
      </div>

      {/* Confirmation Banner */}
      {confirmationNotice && (
        <div className="border border-[#191816] bg-[#191816] text-[#FAF8F3] p-3 text-xs font-mono-data flex items-center justify-between shadow-[2px_2px_0px_#1D4ED8]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#1D4ED8]" />
            <span>{confirmationNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setConfirmationNotice(null)}
            className="text-xs underline text-[#FAF8F3]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main 2-Column or Stacked Inspection Area */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Compact Event Timeline / Sequence (Left 5 Cols) */}
        <div className="md:col-span-5 border border-[#191816] bg-white">
          <div className="p-3 border-b border-[#191816] bg-[#FAF8F3] flex items-center justify-between">
            <span className="text-xs font-bold uppercase font-mono-data text-[#191816]">
              Observed Events ({events.length})
            </span>
            <span className="text-[11px] font-mono-data text-[#6E6A62]">
              Chronological
            </span>
          </div>

          <div className="divide-y divide-[#E5E0D5]">
            {events.map((event, index) => {
              const isSelected = event.id === activeEvent?.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`w-full p-3.5 text-left transition-colors cursor-pointer block ${
                    isSelected
                      ? 'bg-[#FAF8F3] border-l-4 border-l-[#1D4ED8]'
                      : 'hover:bg-[#FCFBF8]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono-data text-[#59564F]">
                    <span>0{index + 1}. {event.timestamp}</span>
                    <span className="text-[11px]">{event.durationSec}s</span>
                  </div>

                  <div className="font-serif-display font-bold text-sm text-[#191816] mt-1">
                    {event.title}
                  </div>

                  <div className={`text-[11px] font-mono-data mt-1.5 ${getStatusStyle(event.status)}`}>
                    {event.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Event Details & Candidate Context (Right 7 Cols) */}
        {activeEvent && (
          <div className="md:col-span-7 space-y-4">
            {/* Event & Candidate Context Card */}
            <div className="border border-[#191816] bg-white p-5 shadow-[3px_3px_0px_#191816]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E0D5]">
                <div>
                  <span className="text-[10px] uppercase font-mono-data text-[#6E6A62] block">
                    Event Focus
                  </span>
                  <h2 className="font-serif-display text-xl font-bold text-[#191816]">
                    {activeEvent.title}
                  </h2>
                </div>
                <div className="text-right text-xs font-mono-data text-[#59564F]">
                  <span className="block">{activeEvent.timestamp}</span>
                  <span className="text-[11px] text-[#6E6A62]">
                    Category: {activeEvent.movementCategory}
                  </span>
                </div>
              </div>

              {/* Status indicator */}
              <div className="mt-3 py-1.5 px-2.5 bg-[#FAF8F3] border border-[#E5E0D5] flex items-center justify-between text-xs font-mono-data">
                <span className="text-[#6E6A62]">Current evaluation:</span>
                <span className={getStatusStyle(activeEvent.status)}>
                  {activeEvent.status}
                </span>
              </div>

              {/* The Candidate's Explanation (The Key Feature) */}
              <div className="mt-4 p-4 border border-[#191816] bg-[#FAF8F3]">
                <div className="text-[10px] uppercase font-mono-data text-[#6E6A62] mb-1">
                  Candidate context (Submitted {activeEvent.candidateSubmittedAt})
                </div>
                <p className="font-serif-display text-lg text-[#191816] italic leading-snug">
                  "{activeEvent.candidateContext}"
                </p>
                {activeEvent.reviewerNote && (
                  <div className="mt-2 pt-2 border-t border-[#E5E0D5] text-xs font-mono-data text-[#59564F]">
                    <strong>Reviewer note: </strong>
                    {activeEvent.reviewerNote}
                  </div>
                )}
              </div>

              {/* Reviewer Action Buttons */}
              <div className="mt-5 space-y-2">
                <div className="text-[11px] font-mono-data uppercase tracking-wider text-[#6E6A62]">
                  Reviewer determination:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Action 1: Record as non-violation */}
                  <button
                    type="button"
                    onClick={() =>
                      handleAction(
                        'Recorded as non-violation',
                        `Recorded "${activeEvent.title}" as non-violation.`
                      )
                    }
                    className="px-3 py-2.5 bg-[#1D4ED8] text-white text-xs font-bold uppercase tracking-wider border border-[#191816] shadow-[2px_2px_0px_#191816] hover:bg-[#1842B6] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
                  >
                    Record as non-violation
                  </button>

                  {/* Action 2: Ask a follow-up */}
                  <button
                    type="button"
                    onClick={() => setIsAskingFollowUp(!isAskingFollowUp)}
                    className="px-3 py-2.5 bg-[#F8E3E3] text-[#191816] text-xs font-bold uppercase tracking-wider border border-[#191816] shadow-[2px_2px_0px_#191816] hover:bg-[#F3D0D0] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
                  >
                    Ask a follow-up
                  </button>

                  {/* Action 3: Escalate for human review */}
                  <button
                    type="button"
                    onClick={() =>
                      handleAction(
                        'Escalated for human review',
                        `Escalated "${activeEvent.title}" for senior educator review.`
                      )
                    }
                    className="px-3 py-2.5 bg-[#D9381E] text-white text-xs font-bold uppercase tracking-wider border border-[#191816] shadow-[2px_2px_0px_#191816] hover:bg-[#BF2E16] active:translate-x-0.5 active:translate-y-0.5 transition-all text-center"
                  >
                    Escalate for human review
                  </button>
                </div>
              </div>

              {/* Follow-up question input */}
              {isAskingFollowUp && (
                <div className="mt-3 p-3 border border-[#191816] bg-[#FAF8F3] space-y-2">
                  <label
                    htmlFor="followup-question"
                    className="block text-[11px] font-mono-data uppercase text-[#191816] font-bold"
                  >
                    Question for candidate:
                  </label>
                  <input
                    id="followup-question"
                    type="text"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="e.g. Could you confirm if your desk clock was in view?"
                    className="w-full p-2 text-xs border border-[#191816] bg-white font-mono-data"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAskingFollowUp(false)}
                      className="px-2.5 py-1 text-xs text-[#59564F]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          'Follow-up requested',
                          `Follow-up prompt queued for candidate.`
                        )
                      }
                      className="px-3 py-1 bg-[#191816] text-white text-xs font-bold uppercase font-mono-data"
                    >
                      Send follow-up
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Human Oversight Note */}
            <div className="border border-[#191816] bg-[#FAF8F3] p-3 text-xs text-[#59564F]">
              <strong className="text-[#191816]">Human oversight: </strong>
              No automated disqualifications or algorithmic penalty scoring. Only certified human reviewers make academic determinations.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
