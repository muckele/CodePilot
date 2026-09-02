export const fullSourceStatusArguments = ["status", "--porcelain=v1", "--untracked-files=all"];

export function releaseSourceState({ startRevision, startStatus, endRevision, endStatus }) {
  const startClean = startRevision !== null && startStatus === "";
  const endClean = endRevision !== null && endStatus === "";
  const revisionStable = startRevision !== null && startRevision === endRevision;
  return {
    startClean,
    endClean,
    revisionStable,
    valid: startClean && endClean && revisionStable
  };
}
