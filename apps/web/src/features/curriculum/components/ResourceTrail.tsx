import type { CurriculumDayResponse } from "@codelift/contracts";

type ResourceTrailProps = {
  resourceIds: CurriculumDayResponse["resourceIds"];
  resources: CurriculumDayResponse["resourceLinks"];
};

export function ResourceTrail({ resourceIds, resources }: ResourceTrailProps) {
  return (
    <section className="mission-card resources-card" aria-labelledby="resource-trail-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Course trail</p>
          <h2 id="resource-trail-title">Open the next useful source</h2>
        </div>
        <span className="resource-count">
          {resources.length} {resources.length === 1 ? "resource" : "resources"}
        </span>
      </div>

      <ul className="resource-list">
        {resources.map((resource) => (
          <li key={resource.id}>
            <a href={resource.url} target="_blank" rel="noopener noreferrer">
              <span className="resource-provider">{resource.provider}</span>
              <strong>{resource.title}</strong>
              <span className="resource-meta">
                <span>{resource.type}</span>
                <code>{resource.id}</code>
              </span>
              <span className="resource-arrow" aria-hidden="true">
                ↗
              </span>
              <span className="visually-hidden">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="catalog-keys">
        <span>Catalog keys:</span> <code>{resourceIds.join(", ")}</code>
      </p>
    </section>
  );
}
