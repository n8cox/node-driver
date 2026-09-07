interface IdentityStripProps {
  cardCount: number;
  onClear: () => void;
}

export function IdentityStrip({ cardCount, onClear }: IdentityStripProps) {
  return (
    <header className="identity-strip">
      <div className="identity-main">
        <span className="product-label">Pulse Board</span>
        <span className="identity-name">MI Build Lab</span>
        <span className="identity-desc">Operator status surface · localStorage v1</span>
      </div>
      <div className="identity-actions">
        <span className="adapter-badge">{cardCount} cards</span>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => {
            if (cardCount === 0) return;
            if (window.confirm('Clear all cards? This cannot be undone.')) {
              onClear();
            }
          }}
          disabled={cardCount === 0}
        >
          Clear all
        </button>
      </div>
    </header>
  );
}
