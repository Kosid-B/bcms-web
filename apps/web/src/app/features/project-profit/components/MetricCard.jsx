export default function MetricCard({ label, value }) {
  return (
    <article className="project-profit-metric-card">
      <p className="project-profit-metric-label">{label}</p>
      <p className="project-profit-metric-value">{value}</p>
    </article>
  );
}
