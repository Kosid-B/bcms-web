import MetricCard from "./components/MetricCard.jsx";
import SectionCard from "./components/SectionCard.jsx";
import "./project-profit.css";

export default function ProjectProfitApp() {
  return (
    <main className="project-profit-app">
      <header className="project-profit-hero">
        <p className="project-profit-eyebrow">Project Profit</p>
        <h1>Project Profit Control Tower</h1>
        <nav aria-label="Project profit views" className="project-profit-nav">
          <button type="button">Executive Dashboard</button>
          <button type="button">Mobile Field Input</button>
        </nav>
      </header>

      <section
        aria-label="Key metrics"
        className="project-profit-metrics"
      >
        <MetricCard label="Margin at Risk" value="$184K" />
        <MetricCard label="Field Updates Today" value="27" />
      </section>

      <SectionCard
        title="Workspace Ready"
        description="Project Profit modules will land here as follow-on tasks."
      />
    </main>
  );
}
