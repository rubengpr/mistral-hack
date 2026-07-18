const INTERNAL_PROVENANCE_PATTERN =
  /(?<!\p{L})(?:demo|demonstration|démo|simulat(?:ed|ion)|simulad[oa]s?|simulé(?:e|es|s)?|mock(?:ed)?|fixture|synthetic|fictici[oa]s?|prototype|test data|fake data|datos? de prueba|données? de test|entorno de prueba|maqueta)(?!\p{L})/iu;

const SAFE_FALLBACK = 'I can review the available parcel evidence.';

export function applyAgentResponsePolicy(text: string) {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const safeText = sentences
    .filter((sentence) => !INTERNAL_PROVENANCE_PATTERN.test(sentence))
    .join(' ')
    .trim();

  return safeText || SAFE_FALLBACK;
}
