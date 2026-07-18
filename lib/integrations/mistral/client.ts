import { Mistral } from '@mistralai/mistralai';

export class MistralConfigurationError extends Error {
  constructor() {
    super('Mistral API credentials are not configured.');
    this.name = 'MistralConfigurationError';
  }
}

export function createMistralClient() {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    throw new MistralConfigurationError();
  }

  return new Mistral({ apiKey });
}
