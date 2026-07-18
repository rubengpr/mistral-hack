import { ArrowUpRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const AI_CAPABILITIES = [
  {
    number: '01',
    title: 'Talk to the field agent',
    models:
      'mistral-medium-3-5 · voxtral-mini-2602 · voxtral-mini-tts-2603',
    description:
      'Medium 3.5 connects parcel, sensor, weather, and history tools. Voxtral handles transcription and spoken replies.',
  },
  {
    number: '02',
    title: 'Analyze field photos',
    models: 'mistral-medium-3-5',
    description:
      'Multimodal vision compares visible observations with parcel evidence while preserving uncertainty.',
  },
  {
    number: '03',
    title: 'Draft the inspection record',
    models: 'mistral-medium-3-5',
    description:
      'Structured generation turns reviewed sensor, weather, photo, and technician evidence into a concise report.',
  },
] as const;

export default function Home() {
  return (
    <main className="landing-page relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="landing-orb pointer-events-none absolute left-[58%] top-24 size-[30rem] rounded-full bg-accent/80 blur-3xl"
      />

      <header className="relative flex items-center justify-between border-b border-primary/10 px-5 py-4 sm:px-8 lg:px-12">
        <Link
          aria-label="Vinea home"
          className="group flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em]"
          href="/"
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:rotate-[-4deg] group-hover:scale-105 motion-reduce:transition-none">
            V
          </span>
          Vinea
        </Link>

        <a
          aria-label="Visit Mistral AI"
          className="group -mr-2 flex h-8 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          href="https://mistral.ai/"
          rel="noreferrer"
          target="_blank"
        >
          <span className="hidden text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:inline">
            Powered by
          </span>
          <span className="relative h-[22px] w-[126px] overflow-hidden">
            <Image
              alt="Mistral"
              className="absolute left-1/2 top-1/2 h-auto w-[180%] max-w-none -translate-x-1/2 -translate-y-1/2 mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
              height={680}
              src="/mistral-logo-lockup.webp"
              width={1080}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-background/80 to-transparent opacity-0 transition-all duration-700 ease-out group-hover:left-[120%] group-hover:opacity-100 motion-reduce:hidden"
            />
          </span>
        </a>
      </header>

      <section className="relative flex flex-1 flex-col justify-between px-5 pb-10 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-12 lg:pt-24">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <h1 className="max-w-6xl text-balance text-[clamp(4rem,11vw,9.5rem)] font-medium leading-[0.84] tracking-[-0.07em]">
            Know your vineyards.
            <br />
            <span className="text-primary">Act in time.</span>
          </h1>

          <div className="flex max-w-sm flex-col items-start gap-6 pb-2 lg:pb-3">
            <p className="text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
              Vinea reviews sensor, weather, and field evidence across vineyard
              portfolios, showing agronomists which parcel needs attention next.
            </p>
            <Button asChild size="lg">
              <Link className="group" href="/map">
                Open the map
                <ArrowUpRight
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
                  data-icon="inline-end"
                />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 border-t lg:mt-28">
          <div className="grid lg:grid-cols-3">
            {AI_CAPABILITIES.map((capability) => (
              <article
                className="group relative grid grid-cols-[2rem_1fr] gap-4 border-b py-7 last:border-b-0 lg:grid-cols-1 lg:gap-8 lg:border-b-0 lg:border-r lg:px-8 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
                key={capability.number}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                />
                <p className="font-mono text-xs text-primary">
                  {capability.number}
                </p>
                <div className="flex flex-col gap-2 transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none">
                  <h2 className="text-base font-medium">{capability.title}</h2>
                  <p className="font-mono text-[0.68rem] leading-relaxed text-primary">
                    {capability.models}
                  </p>
                  <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
