export interface IssueListItem {
  path: string
  message: string
  value?: unknown
}

export interface IssueListProps {
  heading: string
  note?: string
  issues: IssueListItem[]
}

/** Validation problems, addressed by JSON path, in the importer's error style. */
export function IssueList({ heading, note, issues }: IssueListProps) {
  return (
    <div className="st-errors" role="alert">
      <h3 className="st-errors__heading">{heading}</h3>
      {note ? <p className="st-errors__note">{note}</p> : null}
      <ul className="st-errors__list">
        {issues.map((issue, index) => (
          <li key={`${issue.path}-${index}`} className="st-errors__item">
            <code className="st-errors__path">{issue.path}</code>
            <span className="st-errors__message">{issue.message}</span>
            {issue.value !== undefined ? (
              <code className="st-errors__value">{preview(issue.value)}</code>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

function preview(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 160 ? `${text.slice(0, 157)}…` : text
}
