import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function ParcelNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Parcel not found</CardTitle>
          <CardDescription>
            This parcel does not exist in the current portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Return to the map to select one of the available parcels.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/map">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Back to map
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
