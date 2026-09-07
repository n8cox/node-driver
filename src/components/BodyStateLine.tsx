import type { BodyState } from '@/types/ensemble';

interface BodyStateLineProps {
  bodyState: BodyState;
  /** Nested activity rows use a compact layout. */
  compact?: boolean;
}

/** Renders body-state: state, optional engagement, activity line. Driving is shown on the row badge. */
export function BodyStateLine({ bodyState, compact = false }: BodyStateLineProps) {
  const parts: string[] = [bodyState.state];

  if (bodyState.engagement) {
    parts.push(`engagement: ${bodyState.engagement}`);
  }

  const meta = parts.join(' · ');

  return (
    <div className={`body-state ${compact ? 'body-state--compact' : ''}`}>
      <span className="body-state-meta" title={meta}>
        {meta}
      </span>
      <span className="body-state-activity truncate" title={bodyState.activityLine}>
        {bodyState.activityLine}
      </span>
    </div>
  );
}
