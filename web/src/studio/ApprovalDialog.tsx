import type { QualityWarning } from './quality'

export interface ApprovalDialogProps {
  warnings: QualityWarning[]
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * The creator's explicit approval (master plan §27 step 4). Quality warnings
 * are shown, never enforced, alongside the human checklist from §36 — the
 * questions no validator can answer.
 */
export function ApprovalDialog({ warnings, busy, onConfirm, onCancel }: ApprovalDialogProps) {
  return (
    <section className="st-approval" aria-labelledby="st-approval-heading">
      <h3 id="st-approval-heading" className="st-approval__heading">
        Approve this lesson?
      </h3>
      {warnings.length > 0 ? (
        <>
          <p className="st-approval__note">These do not block approval, but look at them first:</p>
          <ul className="st-approval__warnings">
            {warnings.map((warning, index) => (
              <li key={`${warning.path}-${index}`}>
                <code>{warning.path}</code> {warning.message}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="st-approval__note st-valid">No quality warnings.</p>
      )}
      <details className="st-approval__checklist" open>
        <summary>Before approving</summary>
        <ul>
          <li>Would an adult beginner be proud of the finished drawing?</li>
          <li>Does it look drawn by a human hand rather than machine-perfect?</li>
          <li>Can it be finished in about five minutes?</li>
          <li>Does each step feel like one understandable action, in a natural order?</li>
          <li>Is every stroke needed, and does the simplification of the reference make sense?</li>
          <li>Is the difficulty right, coming after the previous lesson?</li>
        </ul>
      </details>
      <div className="st-approval__actions">
        <button type="button" className="st-button st-button--primary" disabled={busy} onClick={onConfirm}>
          {busy ? 'Saving…' : 'Approve & save'}
        </button>
        <button type="button" className="st-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
