import type { ThesisResult } from '@verithesis/enclave-worker';
import { buildOfficialSignalPayload, suggestedActionFromSignal, officialThesisInput } from '@verithesis/enclave-worker';
import type { SuggestedAction } from '@verithesis/enclave-worker';

export type { SuggestedAction };

export function officialThesisInputFromEnv() {
  return officialThesisInput();
}

export function buildOfficialSignalView(result: ThesisResult) {
  return buildOfficialSignalPayload(result);
}

export { suggestedActionFromSignal, officialThesisInput };