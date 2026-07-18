import { Resend } from 'resend';

export class ResendConfigurationError extends Error {
  constructor() {
    super('Resend API credentials are not configured.');
    this.name = 'ResendConfigurationError';
  }
}

export function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new ResendConfigurationError();
  }

  return new Resend(apiKey);
}
