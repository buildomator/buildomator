/**
 * STATE.md Document Module.
 *
 * Pure transforms for STATE.md text. This module does not read the filesystem
 * and does not own persistence or locking.
 */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stateExtractField(content: string, fieldName: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*[ \\t]*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:[ \\t]*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

export function stateReplaceField(content: string, fieldName: string, newValue: string): string | null {
  const escaped = escapeRegex(fieldName);
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(boldPattern, (_match, prefix: string) => `${prefix}${newValue}`);
  }
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(plainPattern, (_match, prefix: string) => `${prefix}${newValue}`);
  }
  return null;
}

export function stateReplaceFieldWithFallback(
  content: string,
  primary: string,
  fallback: string | null,
  value: string,
): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

/**
 * Known template default values that the SDK state handlers historically write.
 *
 * When a state handler is about to overwrite a "soft" field (Status, Last Activity,
 * Resume File, etc.) it consults this set. If the current value matches a template
 * default, the handler proceeds (it's overwriting its own past output). If the
 * current value is NOT a template default, the handler treats it as executor-authored
 * content and PRESERVES it.
 *
 * This preservation contract was added in plugin v2.45.0 (issue #9) after a real
 * data-loss-shape bug where state.advance-plan / state.record-session unconditionally
 * overwrote rich executor-authored Status / Last Activity / Resume File content with
 * template defaults, silently losing the executor's work.
 */
export const KNOWN_TEMPLATE_DEFAULTS: ReadonlySet<string> = new Set([
  '',
  'Ready to execute',
  'Phase complete — ready for verification',
  'Phase complete - ready for verification', // ASCII hyphen variant
  'unknown',
  'None',
  'TBD',
]);

/**
 * Returns true if `value` is a known template default (handler-owned) OR a bare
 * ISO date (which the handlers also write as a default Last Activity value).
 * Returns false if `value` looks executor-authored.
 */
export function isStateTemplateDefault(value: string | null | undefined): boolean {
  if (value === null || value === undefined) return true;
  const trimmed = value.trim();
  if (KNOWN_TEMPLATE_DEFAULTS.has(trimmed)) return true;
  // Bare ISO date "YYYY-MM-DD" (handler-written Last Activity short form)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  // ISO timestamp "YYYY-MM-DDTHH:MM:SS..." with no descriptive suffix
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(trimmed)) return true;
  return false;
}

/**
 * Replace a field's value ONLY IF the current value is a known template default
 * (per `isStateTemplateDefault`). Preserves executor-authored content untouched.
 *
 * Returns:
 * - Updated content if the replace happened (current was template-default)
 * - Original content (unchanged) if the field exists but the current value is
 *   executor-authored (non-template). Logs a hint via the returned `preserved` flag.
 * - `null` if the field is not present in the content at all.
 *
 * Use this in state handlers that previously called `stateReplaceField` or
 * `stateReplaceFieldWithFallback` for "soft" fields. Hard fields the handler
 * legitimately owns (frontmatter `percent`, structural progress lines, the
 * "Plan: N of M" summary, etc.) can continue using the unconditional helpers.
 */
export function stateReplaceFieldIfTemplate(
  content: string,
  fieldName: string,
  newValue: string,
): { content: string; outcome: 'replaced' | 'preserved' | 'not_found' } {
  const current = stateExtractField(content, fieldName);
  if (current === null) {
    return { content, outcome: 'not_found' };
  }
  if (!isStateTemplateDefault(current)) {
    return { content, outcome: 'preserved' };
  }
  const replaced = stateReplaceField(content, fieldName, newValue);
  if (replaced === null) {
    // Should not happen if extractField succeeded, but defensive.
    return { content, outcome: 'not_found' };
  }
  return { content: replaced, outcome: 'replaced' };
}

/**
 * Like `stateReplaceFieldIfTemplate` but tries a primary field name and a
 * fallback (e.g., "Last Activity" then "Last activity"). Returns the first
 * outcome that wasn't `not_found`. If both are not_found, returns not_found.
 */
export function stateReplaceFieldIfTemplateWithFallback(
  content: string,
  primary: string,
  fallback: string | null,
  newValue: string,
): { content: string; outcome: 'replaced' | 'preserved' | 'not_found' } {
  const first = stateReplaceFieldIfTemplate(content, primary, newValue);
  if (first.outcome !== 'not_found') return first;
  if (fallback) {
    return stateReplaceFieldIfTemplate(content, fallback, newValue);
  }
  return first;
}

export function normalizeStateStatus(status: string | null | undefined, pausedAt?: string | null): string {
  let normalizedStatus = status || 'unknown';
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('paused') || statusLower.includes('stopped') || pausedAt) {
    normalizedStatus = 'paused';
  } else if (statusLower.includes('executing') || statusLower.includes('in progress')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
    normalizedStatus = 'planning';
  } else if (statusLower.includes('discussing')) {
    normalizedStatus = 'discussing';
  } else if (statusLower.includes('verif')) {
    normalizedStatus = 'verifying';
  } else if (statusLower.includes('complete') || statusLower.includes('done')) {
    normalizedStatus = 'completed';
  } else if (statusLower.includes('ready to execute')) {
    normalizedStatus = 'executing';
  }
  return normalizedStatus;
}

export function computeProgressPercent(
  completedPlans: number | null,
  totalPlans: number | null,
  completedPhases: number | null,
  totalPhases: number | null,
): number | null {
  const hasPlanData = totalPlans !== null && totalPlans > 0 && completedPlans !== null;
  const hasPhaseData = totalPhases !== null && totalPhases > 0 && completedPhases !== null;

  if (!hasPlanData && !hasPhaseData) return null;

  const planFraction = hasPlanData ? completedPlans / totalPlans : 1;
  const phaseFraction = hasPhaseData ? completedPhases / totalPhases : 1;

  return Math.min(100, Math.round(Math.min(planFraction, phaseFraction) * 100));
}

function toFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function existingProgressExceedsDerived(
  existingProgress: Record<string, unknown>,
  derivedProgress: Record<string, unknown>,
  key: string,
): boolean {
  const existing = toFiniteNumber(existingProgress[key]);
  const derived = toFiniteNumber(derivedProgress[key]);
  return existing !== null && derived !== null && existing > derived;
}

export function shouldPreserveExistingProgress(
  existingProgress: unknown,
  derivedProgress: unknown,
): existingProgress is Record<string, unknown> {
  if (!existingProgress || typeof existingProgress !== 'object') return false;
  if (!derivedProgress || typeof derivedProgress !== 'object') return false;

  const existing = existingProgress as Record<string, unknown>;
  const derived = derivedProgress as Record<string, unknown>;
  return (
    existingProgressExceedsDerived(existing, derived, 'total_phases') ||
    existingProgressExceedsDerived(existing, derived, 'completed_phases') ||
    existingProgressExceedsDerived(existing, derived, 'total_plans') ||
    existingProgressExceedsDerived(existing, derived, 'completed_plans')
  );
}

export function normalizeProgressNumbers(progress: unknown): unknown {
  if (!progress || typeof progress !== 'object') return progress;

  const normalized: Record<string, unknown> = { ...(progress as Record<string, unknown>) };
  for (const key of ['total_phases', 'completed_phases', 'total_plans', 'completed_plans', 'percent']) {
    const number = toFiniteNumber(normalized[key]);
    if (number !== null) normalized[key] = number;
  }
  return normalized;
}
