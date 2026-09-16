# Handoff: buildomator.com SEO for the ASD-STE100 anti-slop angle

For the website agent (the buildomator.com Astro repo). The sourcecode agent does not edit that repo; this is a recommendation set, not a change.

## Context

Plugin v4.7.0 shipped a user-docs prose ratchet (`bin/maintenance/check-user-docs-prose.cjs`) that is a native port of the machine-checkable subset of ASD-STE100 Simplified Technical English, the 1986 aerospace writing standard. The idea traces to the video "The cure for AI slop is a 1986 aircraft manual" (ASD-STE100 applied to LLM output). The repo README now documents it and lists ASD-STE100 as a fourth idea-only upstream. The GitHub repo now also carries topics (asd-ste100, simplified-technical-english, ai-slop, anti-slop, ...) and its homepage points at buildomator.com.

The user wants the project to be findable by people and by AI search for queries like "ASD-STE100 coding", "Simplified Technical English AI", "reduce AI slop coding agent", "anti-slop AI docs". That term is niche and low-competition, so a focused page can rank.

## Recommended work on buildomator.com

1. A dedicated indexable page, for example `/anti-slop` or `/ste`, titled something like "ASD-STE100 for coding agents: a machine-checkable cure for AI slop". One clear H1 with the exact phrases, a short explainer of the standard, and how Buildomator ports it as a docs ratchet. Link out to the ASD-STE100 Wikipedia page and back to the GitHub repo.
2. Page metadata: a `<title>` and meta description carrying "ASD-STE100", "Simplified Technical English", and "AI slop"; OpenGraph and Twitter card tags; a canonical URL.
3. Structured data: an Article or TechArticle JSON-LD block so AI search and rich results can parse the topic cleanly.
4. Internal links: link the new page from the homepage and any features section, and from the existing docs, so it accrues internal link weight.
5. Sitemap and robots: confirm the page is in `sitemap.xml` and not blocked; submit the sitemap in Search Console.
6. Content depth: a short before/after example (a slop paragraph vs the same text under the ratchet) reads well for humans and gives retrieval systems concrete text to quote. Keep the prose itself clean (no em-dashes, no filler marketing words) so it passes the same bar it describes.

## Reality check

GitHub README plus repo topics give modest organic discovery and good AI-answer retrieval already. The website page is the lever for classic search ranking. Neither is deterministic; the niche term is the advantage.
