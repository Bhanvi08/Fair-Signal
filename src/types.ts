export type ActiveView = 'candidate' | 'reviewer';

export type MovementCategory = 
  | 'Stretching'
  | 'Getting water'
  | 'Sneezing'
  | 'Other'
  | 'Prefer not to say';

export type ReviewerVerdict = 
  | 'Context received · human review only'
  | 'Recorded as non-violation'
  | 'Follow-up requested'
  | 'Escalated for human review';

export interface AssessmentEvent {
  id: string;
  timestamp: string;
  title: string;
  durationSec: number;
  movementCategory: MovementCategory;
  candidateContext: string;
  candidateSubmittedAt: string;
  status: ReviewerVerdict;
  reviewerNote?: string;
  isInitialDemo?: boolean;
}
