import { Link } from "react-router";

function PolicyLayout({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="account-panel policy-page">
      <header className="account-intro">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </header>
      {children}
      <p className="policy-page__return">
        <Link to="/login">Return to sign in</Link>
      </p>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <PolicyLayout eyebrow="Private-pilot policy" title="Privacy at CodeLift">
      <p>
        CodeLift stores your email, Argon2id password hash, profile and preferences, curriculum
        progress, learner-authored evidence and reflections, tasks, reviews, portfolio/career
        records, private-note search sources, and the derived records needed to operate those
        features. Private notes, reflections, evidence, embeddings, and retrieval results are scoped
        to the owning account at the database query boundary.
      </p>
      <h2>AI and external services</h2>
      <p>
        The private-pilot production profile uses deterministic mock AI. It does not call an
        external model, download a model, or require the optional Python service. “Mock” means
        predictable local software responses for testing the product workflow; it is not a claim
        that a model understood your work.
      </p>
      <h2>Operational logs</h2>
      <p>
        Structured logs contain request IDs, normalized routes, methods, response status, timing,
        safe error classes, and aggregate operational events. They exclude request/response bodies,
        email addresses, passwords, cookies, CSRF values, invitation/recovery tokens, private notes,
        evidence, reflections, prompts, model responses, database queries, and connection strings.
      </p>
      <h2>Export, deletion, and backups</h2>
      <p>
        Account settings provide a versioned JSON export of account-owned source and derived data.
        Password, session, CSRF, invitation, and recovery secrets are excluded. Account deletion
        removes active product and derived records transactionally. A hosting operator must publish
        the encrypted-backup retention window before invitations are sent; deleted data can remain
        in a backup until that window expires, and an isolated restore must not silently reactivate
        a deleted account.
      </p>
      <p>
        This plain-language pilot policy is not legal advice. The owner must complete privacy and
        legal review before any open public registration.
      </p>
    </PolicyLayout>
  );
}

export function TermsPage() {
  return (
    <PolicyLayout eyebrow="Private-pilot terms" title="Learning with honest evidence">
      <p>
        CodeLift is an educational accountability tool. It does not guarantee mastery,
        certification, employment, promotion, interview performance, or the accuracy or continued
        availability of third-party learning resources.
      </p>
      <p>
        Core and Recovery are distinct records. Generated guidance never proves understanding;
        learner-authored evidence and retrieval remain required. Do not submit employer secrets,
        regulated data, credentials, or another person’s private information.
      </p>
      <p>
        Private-pilot access may be closed to protect participants or investigate security and data
        incidents. These working terms require owner/legal review before public registration and are
        not legal advice.
      </p>
    </PolicyLayout>
  );
}

export function SupportPage() {
  return (
    <PolicyLayout eyebrow="Pilot support" title="Get help without exposing private work">
      <p>
        Contact the person who issued your invitation through the same out-of-band channel. Include
        the time, page, what you expected, and the on-screen support reference (request ID). Do not
        send passwords, cookies, CSRF values, invitation/recovery links, private notes, evidence,
        prompts, or database connection details.
      </p>
      <h2>Account recovery</h2>
      <p>
        The operator can issue a one-time, expiring password-reset link after confirming the request
        out of band. CodeLift does not send email in the MVP profile. A successful reset revokes all
        sessions and requires a fresh sign-in.
      </p>
      <h2>Security concerns</h2>
      <p>
        Report suspected cross-account access, exposed secrets, unsafe agent behavior, or data loss
        immediately to the invitation issuer and stop using the affected flow. The operator will use
        the request ID and privacy-minimized logs to investigate.
      </p>
    </PolicyLayout>
  );
}
