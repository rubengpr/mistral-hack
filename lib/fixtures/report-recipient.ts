import { AFFECTED_PARCEL_ID } from '@/lib/fixtures/canonical-demo-scenario';

export type ParcelReportRecipient = {
  email: string;
};

const REPORT_RECIPIENTS: Record<string, ParcelReportRecipient> = {
  [AFFECTED_PARCEL_ID]: {
    email: 'rubengpr@gmail.com',
  },
};

export function getParcelReportRecipient(parcelId: string) {
  return REPORT_RECIPIENTS[parcelId];
}
