import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="state-panel state-panel--error" aria-labelledby="not-found-title">
      <p className="eyebrow">Off the current trail</p>
      <h1 id="not-found-title">That page is not part of this preview.</h1>
      <p>The first curriculum mission is ready when you are.</p>
      <Link className="button button--primary" to="/curriculum/1">
        Open Day 1
      </Link>
    </section>
  );
}
