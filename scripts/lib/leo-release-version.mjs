export function parseStableVersion(tagName) {
  const match = tagName.match(/(?:^|-)v?(\d+\.\d+\.\d+)$/);
  return match ? match[1].split(".").map(Number) : null;
}

export function compareVersions(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function shouldSyncTarget({ explicitRef, target, currentSourceRef, currentResolvedCommit }) {
  if (explicitRef) {
    return currentSourceRef !== target.name;
  }

  return currentSourceRef !== target.name &&
    (!target.commitSha || currentResolvedCommit !== target.commitSha);
}
