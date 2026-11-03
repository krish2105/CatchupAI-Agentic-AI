export default function PageHeading({
  eyebrow,
  title,
  accent,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          {accent ? <> <span className="serif">{accent}</span></> : null}
        </h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}
