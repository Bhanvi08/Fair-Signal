import { useState } from 'react';
import { ActiveView, AssessmentEvent, ReviewerVerdict } from './types';
import { HeaderNav } from './components/HeaderNav';
import { CandidateDemo } from './components/CandidateDemo';
import { ReviewerView } from './components/ReviewerView';
import { PrivacyFooter } from './components/PrivacyFooter';

// Initial state demonstrating brief head movement followed by candidate context
const INITIAL_EVENTS: AssessmentEvent[] = [
  {
    id: 'ev-initial-1',
    timestamp: '00:14:22',
    title: 'Brief head movement',
    durationSec: 4.2,
    movementCategory: 'Stretching',
    candidateContext: 'I stretched because my neck was uncomfortable.',
    candidateSubmittedAt: '00:14:38',
    status: 'Context received · human review only',
    isInitialDemo: true,
  },
];

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('candidate');
  const [events, setEvents] = useState<AssessmentEvent[]>(INITIAL_EVENTS);

  // Add event from candidate camera demo
  const handleAddEvent = (newEvent: AssessmentEvent) => {
    setEvents((prev) => [newEvent, ...prev]);
  };

  // Reviewer actions on events
  const handleUpdateEventStatus = (
    eventId: string,
    newStatus: ReviewerVerdict,
    note?: string
  ) => {
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          return {
            ...ev,
            status: newStatus,
            reviewerNote: note || ev.reviewerNote,
          };
        }
        return ev;
      })
    );
  };

  // Reset demo back to initial state
  const handleResetDemo = () => {
    setEvents(INITIAL_EVENTS);
    setActiveView('candidate');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#191816]">
      {/* 2 Flat Tab Buttons in Header */}
      <HeaderNav
        activeView={activeView}
        onSelectView={setActiveView}
        eventCount={events.length}
        onResetDemo={handleResetDemo}
      />

      {/* Main Single-Screen View Switcher */}
      <main className="flex-1 px-4 md:px-8 py-6 sm:py-8 flex flex-col justify-center">
        {activeView === 'candidate' ? (
          <CandidateDemo
            onAddEvent={handleAddEvent}
            onNavigateToReviewer={() => setActiveView('reviewer')}
          />
        ) : (
          <ReviewerView
            events={events}
            onUpdateEventStatus={handleUpdateEventStatus}
          />
        )}
      </main>

      {/* Modernist Footer with exact required copy */}
      <PrivacyFooter />
    </div>
  );
}
