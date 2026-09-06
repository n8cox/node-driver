import type { BodyState } from '@/types/ensemble';

interface BodyStateLineProps {
  bodyState: BodyState;
}

/** Renders body-state: state, optional engagement, driving flag, activity line. */
export function BodyStateLine({ bodyState }: BodyStateLineProps) {
  const parts: string[] = [bodyState.state];

  if (bodyState.engagement) {
    parts.push(`engagement: ${bodyState.engagement}`);
  }

  if (bodyState.driving !== undefined) {
    parts.push(bodyState.driving ? 'driving' : 'not driving');
  }

  return (
    <div className="body-state">
      <span className="body-state-meta">{parts.join(' · ')}</span>
      <span className="body-state-activity">{bodyState.activityLine}</span>
    </div>
  );
}
