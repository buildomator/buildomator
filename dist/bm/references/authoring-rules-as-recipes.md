# Authoring Rules: Recipes, Not Prohibitions

How to write and edit Buildomator's own workflow and agent markdown so a rule actually changes behavior.

## 1. Classify the baseline failure first

Before writing a rule, name what the unguided agent does wrong. The fix depends on the class:

- **Shaping failure:** the agent produces the wrong shape of output (wrong structure, missing field, wrong order). It does not know the contract.
- **Discipline failure:** the agent knows the shape and skips a step under pressure (time, token budget, a tempting shortcut).

If you cannot say which class you are fixing, you are not ready to write the rule.

## 2. Shaping problems get a recipe, not a prohibition

Give the positive contract: the fields, the order, a worked example. A/B tests on Superpowers-style skills showed that prohibitions can underperform even no guidance on shaping failures, because "do not X" never tells the agent what to produce. Reserve "do not X" for discipline failures, and even then pair it with the step to do instead.

Before and after:

- Before: `Do not write vague verify steps`
- After: `Every <verify> names one command that exits non-zero on failure`

## 3. No nuance clauses

An exception must be its own conditional on an observable predicate, for example `If REVIEW.md status is clean, skip the fixer`. Never write "do not X unless it matters" or "use judgment": those push the decision back onto the reader with no test to apply. If you cannot name the predicate, you have not finished the rule.

## Checklist

- Failure class named (shaping or discipline).
- Shaping rule is a recipe (positive contract with fields, order, example).
- Every exception has an observable predicate.
