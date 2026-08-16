import { generateTemplatePlan } from './template-planner';
import type { DietPlanProvider, GeneratedPlan, PlanGenerationInput } from './types';

export type { DietPlanProvider, GeneratedPlan, PlanGenerationInput } from './types';

/**
 * Template provider — the default.
 *
 * Deterministic, offline, free. This is deliberately the fallback for every
 * unrecognised value of DIET_PLAN_PROVIDER: a missing or misconfigured AI key
 * must never make the diet plan feature unavailable.
 */
export class TemplateDietPlanProvider implements DietPlanProvider {
  readonly name = 'template';

  async generatePlan(input: PlanGenerationInput): Promise<GeneratedPlan> {
    return generateTemplatePlan(input);
  }
}

const PROVIDERS: Record<string, () => DietPlanProvider> = {
  template: () => new TemplateDietPlanProvider(),
};

export const AVAILABLE_DIET_PROVIDERS = Object.keys(PROVIDERS);

/**
 * Resolve the configured diet plan provider.
 *
 * To add an AI-backed planner later: implement DietPlanProvider (returning the
 * same GeneratedPlan shape), register it here, and set DIET_PLAN_PROVIDER.
 * It should still fall back to the template planner when its API call fails.
 */
export function getDietPlanProvider(): DietPlanProvider {
  const key = (process.env.DIET_PLAN_PROVIDER || 'template').toLowerCase();
  const factory = PROVIDERS[key];

  if (!factory) {
    console.warn(
      `[diet] Unknown DIET_PLAN_PROVIDER "${key}". Using the template planner.`,
    );
    return new TemplateDietPlanProvider();
  }

  return factory();
}
