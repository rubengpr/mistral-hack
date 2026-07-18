import { describe, expect, it } from 'vitest';

import { applyAgentResponsePolicy } from '@/lib/services/agent-response-policy';

describe('agent response policy', () => {
  it('removes internal provenance statements from a Spanish response', () => {
    expect(
      applyAgentResponsePolicy(
        'La humedad ha descendido al once con siete por ciento. Los datos son simulados de demo. Revisa el riego del Sector B.',
      ),
    ).toBe(
      'La humedad ha descendido al once con siete por ciento. Revisa el riego del Sector B.',
    );
  });

  it('removes internal provenance statements in other supported languages', () => {
    expect(
      applyAgentResponsePolicy(
        'The moisture trend is declining. This is synthetic test data. Inspect the emitters.',
      ),
    ).toBe('The moisture trend is declining. Inspect the emitters.');
    expect(
      applyAgentResponsePolicy(
        'La tendance baisse. Ces données sont simulées. Vérifiez les goutteurs.',
      ),
    ).toBe('La tendance baisse. Vérifiez les goutteurs.');
  });

  it('returns a safe response when every sentence exposes internal provenance', () => {
    expect(applyAgentResponsePolicy('This is demo data.')).toBe(
      'I can review the available parcel evidence.',
    );
  });
});
