'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type { FoodCandidate } from '@/types/food';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImagePicker } from '@/components/food/image-picker';
import { FoodReview } from '@/components/food/food-review';
import { FoodSearchDialog } from '@/components/food/food-search-dialog';
import { readApiError } from '@/lib/utils/fetch';

interface AnalyzeResponse {
  candidates: FoodCandidate[];
  alternatives: { name: string; confidence: number }[];
  confident: boolean;
  notes?: string;
  provider: string;
  model?: string;
  nutritionDegraded: boolean;
}

type Stage = 'idle' | 'analyzing' | 'review';

/**
 * Drives the scan pipeline:
 *   pick image -> analyze -> review & correct -> log
 *
 * Manual entry is available at every stage, including when recognition fails,
 * so the feature is never a dead end.
 */
export function ScanClient() {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [candidates, setCandidates] = useState<FoodCandidate[]>([]);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  async function analyze() {
    if (!file) return;

    setStage('analyzing');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/food/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const message = await readApiError(
          response,
          'Food recognition failed. You can still add the food manually.',
        );
        toast.error(message);
        // Recognition failing is not a dead end — drop into manual review.
        setResult(null);
        setCandidates([]);
        setStage('review');
        return;
      }

      const data = (await response.json()) as AnalyzeResponse;
      setResult(data);
      setCandidates(data.candidates);
      setStage('review');

      if (!data.confident) {
        toast.warning('Not confident about this one — please pick the food yourself.');
      }
    } catch {
      toast.error('Network problem. Please check your connection and try again.');
      setStage('idle');
    }
  }

  function reset() {
    setFile(null);
    setCandidates([]);
    setResult(null);
    setStage('idle');
  }

  return (
    <div>
      {stage !== 'review' ? (
        <>
          <ImagePicker
            onSelect={setFile}
            onClear={() => setFile(null)}
            disabled={stage === 'analyzing'}
          />

          <div className="mt-4 flex flex-col gap-2">
            <Button
              size="lg"
              onClick={analyze}
              disabled={!file || stage === 'analyzing'}
              className="w-full"
            >
              {stage === 'analyzing' ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden />
                  Analyzing…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden />
                  Analyze photo
                </>
              )}
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                setCandidates([]);
                setResult(null);
                setStage('review');
              }}
              disabled={stage === 'analyzing'}
            >
              <Plus aria-hidden />
              Add food manually
            </Button>
          </div>

          {stage === 'analyzing' ? <AnalyzingSkeleton /> : null}
        </>
      ) : (
        <>
          {result && !result.confident ? (
            <Card className="mt-6 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
              <CardContent className="flex gap-3 p-4">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium">
                    Food could not be identified confidently.
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Please select or enter the food manually.
                  </p>
                  {result.alternatives.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      The model&apos;s best guesses were:{' '}
                      {result.alternatives
                        .map((alt) => `${alt.name} (${Math.round(alt.confidence * 100)}%)`)
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {result?.nutritionDegraded ? (
            <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              Nutrition data could not be fetched right now. Search for the food or
              enter the values yourself before saving.
            </p>
          ) : null}

          <FoodReview
            initialCandidates={candidates}
            notes={result?.notes}
            alternatives={result?.alternatives ?? []}
            onStartOver={reset}
            onOpenSearch={() => setSearchOpen(true)}
          />

          <FoodSearchDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            onSelect={(item) => {
              setCandidates((current) => [
                ...current,
                {
                  id: `manual-${Date.now()}`,
                  name: item.name,
                  grams: item.servingSizeGrams ?? 100,
                  nutrition: {
                    caloriesPer100g: item.caloriesPer100g,
                    proteinPer100g: item.proteinPer100g,
                    carbsPer100g: item.carbsPer100g,
                    fatPer100g: item.fatPer100g,
                  },
                  source: item.source,
                  fdcId: item.fdcId,
                  needsNutrition: false,
                },
              ]);
              setSearchOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function AnalyzingSkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-live="polite" aria-busy="true">
      <span className="sr-only">Analyzing your photo</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
