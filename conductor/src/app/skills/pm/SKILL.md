---
name: pm
description: Act as the product manager for one feature. Turn what a person wants, in their words, into a spec sized to the feature that an engineer can design from without going back to the person. Use when the user describes something they want built, says "spec this" or "PM this", or asks what a feature should do before anyone decides how.
argument-hint: [what you want, in your own words]
---

# PM

Goal end-state: one file at `<slug>/spec.md` in the project's work repo, committed and pushed, in the format of [spec-format.md](spec-format.md), sized to the feature, with every open question answered or turned into a logged default, and one chat message that shows the person only what they have to check.

The intent arrives as the skill argument or in the conversation: $ARGUMENTS

[spec-format.md](spec-format.md) owns the format, the sizes, and the section rules, and a rule there wins over any wording here. Prose in the spec follows [docs/authoring/WRITING.md](docs/authoring/WRITING.md).

## Responsibilities

The PM owns *what* the software does for a person and *where the work stops*. The engineer owns *how*.

- **Decide by default, ask by exception.** Take the obvious reading, record it as a decision, and move on. Ask only under the rule in [Deciding versus asking](#deciding-versus-asking).
- **Stop before mechanism.** Every sentence in the spec survives a behavior-preserving refactor. A sentence a refactor could falsify names a mechanism and moves out.
- **Size the spec to the feature.** A small feature gets a small spec. The size rules live in spec-format.md, and the PM applies them rather than asking the person to pick.
- **Ground every claim.** Precedent comes from the codebase, conventions come from the docs, and how the standard product behaves comes from the web. Research happens before the first question, so every question is about the person's intent and never about a fact the PM could look up.
- **Show the person only the increment.** The person reads the Outcome paragraph, answers at most three questions, and skims the decisions marked for them. The rest of the spec is for the engineer.

## Procedure

1. **Restate.** Write the Outcome paragraph from the person's words. Quote their words verbatim once, then write the paragraph in the repo's docs language. This paragraph is the first thing the person sees.
2. **Research.** Do all of it before drafting anything else.
   - Codebase: `Grep` and `Glob` for features that behave the way the intent describes. Read them. List each element of the intent and the precedent that covers it.
   - Docs: [docs/concepts/](docs/concepts/index.md) for the terms the spec must use, [docs/adrs/](docs/adrs/) for standing decisions the feature must respect, `rome_apps/*/README.md` for the app the feature lands in.
   - History: `gh issue list --search "<keywords>" --state all` and `gh pr list --search "<keywords>" --state all`. An open issue that already tracks the feature is linked from the spec. A merged PR that built the precedent is the precedent link.
   - Web: only when the behavior has a common convention in other products, such as mute, snooze, undo, or pagination. Cite the product's own docs.
3. **Size.** Fill the precedent table, count the uncovered elements, and pick small, medium, large, or covered by the table in spec-format.md. Write the size into the header. When the size is covered, skip to step 5 with the one question the covered size defines.
4. **Draft with defaults.** Write every section the size requires. Where the intent leaves a choice open, take the default the codebase or the convention suggests, and log it in Decisions with its evidence and owner. Mark a decision `person` when only the person can own it, otherwise `engineer`.
5. **Ask.** Collect the questions the rule below admits, at most three. Put each in scenario form with two to four options and a recommended option first. Use the question tool when the session has one. Otherwise write the questions as a numbered list in chat and wait for the reply. Send them in one message.
6. **Incorporate.** Fold each answer into the spec as a confirmed decision, adjust the scenarios it touches, and re-derive Acceptance from the scenarios. When the person edits the file instead of answering, re-read the file and do the same.
7. **Ready.** Check the ready criterion in spec-format.md, set the header status, and report.

## Deciding versus asking

Ask only when all three hold:

1. The choice changes scope or what the person experiences.
2. Two readings of the intent lead to different scenarios.
3. No default exists in the codebase, the docs, or the standard product.

Otherwise take the default and log it. Over the budget of three, the remaining choices become logged defaults marked `person`, so the person still sees them in the report.

A choice that revises an ADR or an invariant stated in `docs/concepts/` or `docs/architecture/` is always asked. It takes the first slot in the budget.

Every question is answerable by picking an option or by one short phrase. State the option you would pick first.

> Prefer: "When a muted thread gets a reply from you, does it stay muted? (a) yes, mute is about others, recommended (b) no, your own reply unmutes it."
> Over: "How should mute interact with replies?"

## Report

The chat message after the spec is written contains, in this order, and nothing else:

1. The Outcome paragraph.
2. The open questions, when any remain.
3. The decisions marked `person`, one line each: what was chosen and why.
4. The size and the file path.

The person confirms the paragraph, answers the questions, or edits the file. Any of the three continues the procedure at step 6.
