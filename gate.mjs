export const policy = Object.freeze({ minimumSamples: 20, abortFraction: 0.10 });

export function evaluate(samples, failures) {
  if (samples < policy.minimumSamples) return 'hold';
  return failures / samples >= policy.abortFraction ? 'abort' : 'promote';
}
