import { NextResponse } from 'next/server';

import { getPortfolioWaterReview } from '@/lib/services/portfolio-water-review-service';

export async function GET() {
  try {
    const data = await getPortfolioWaterReview();
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json(
      { error: 'The regional water review is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
