'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import type { FoodItem } from '@/types/food';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { readApiError } from '@/lib/utils/fetch';

interface FoodSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: FoodItem) => void;
}

/** Manual USDA search — the escape hatch whenever recognition is wrong or absent. */
export function FoodSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: FoodSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError('Please enter at least 2 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await fetch(
        `/api/nutrition/search?q=${encodeURIComponent(trimmed)}&limit=12`,
      );

      if (!response.ok) {
        setResults([]);
        setError(await readApiError(response, 'No results found.'));
        return;
      }

      const data = (await response.json()) as { items: FoodItem[] };
      setResults(data.items);
      if (data.items.length === 0) setError('No results found.');
    } catch {
      setResults([]);
      setError('Network problem. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Search foods</DialogTitle>
          <DialogDescription>
            Nutrition data from USDA FoodData Central, shown per 100 g.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={search} className="flex gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. brown rice"
            autoFocus
            aria-label="Food name"
          />
          <Button type="submit" disabled={loading} aria-label="Search">
            {loading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Search aria-hidden />
            )}
          </Button>
        </form>

        <div className="-mx-1 max-h-[45dvh] overflow-y-auto px-1">
          {error ? <p className="py-3 text-sm text-muted-foreground">{error}</p> : null}

          {!error && !searched ? (
            <p className="py-3 text-sm text-muted-foreground">
              Search for a food to see its nutrition.
            </p>
          ) : null}

          <ul className="space-y-2">
            {results.map((item) => (
              <li key={`${item.fdcId ?? item.name}-${item.caloriesPer100g}`}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full rounded-xl border p-3 text-left transition-colors hover:bg-accent focus-visible:bg-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.source === 'cache' ? (
                      <Badge variant="secondary" className="shrink-0">
                        Cached
                      </Badge>
                    ) : null}
                  </div>
                  {item.brand ? (
                    <p className="text-xs text-muted-foreground">{item.brand}</p>
                  ) : null}
                  <p className="tabular mt-1 text-xs text-muted-foreground">
                    {formatNumber(item.caloriesPer100g)} kcal · P{' '}
                    {formatNumber(item.proteinPer100g, 1)} · C{' '}
                    {formatNumber(item.carbsPer100g, 1)} · F{' '}
                    {formatNumber(item.fatPer100g, 1)} (per 100 g)
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
