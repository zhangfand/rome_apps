# Spec format

A **spec** describes one feature from the perspective of the person who uses it: what they can do, in which scenarios, and where the work stops. It is the input to technical design. Unlike a [task spec](docs/authoring/github-issues-task-spec.md), which scopes a change already decided, a spec records the decisions that turn an intent into a bounded feature. Unlike an [ADR](docs/authoring/adrs.md), it holds no mechanism.

## File

- Path: `<slug>/spec.md` in the project's work repo, the separate repo the project's CLAUDE.md names for files agents share. The slug is kebab-case, two to five words, naming the feature and not the area.
- Links into the code repo are full GitHub URLs on the default branch, so they resolve from the work repo.
- Title: `# <area>: <what a person can do>`, present tense. The area follows the [issue title rule](docs/authoring/github-issues.md#title).

  > Prefer: "inbox: a person mutes a thread for a week".
  > Over: "inbox: thread muting".

- Header, directly under the title, one line each: `Size: small | medium | large | covered`, `Status: draft | ready | dropped`, `Intent: "<the person's words, verbatim>"`.
- Language: the repo's docs language. The verbatim intent keeps its own language.

## Sizes

The size decides which sections the spec carries. The PM sets it from the precedent table and the breadth of the change.

| Size | When | Sections |
| --- | --- | --- |
| small | Every element of the intent has a precedent in the codebase, and the change fits one sentence. | Outcome, Scenarios, Out of scope, and Decisions when any decision was made. |
| medium | Some elements have a precedent, or the change spans several files or surfaces. | small, plus Acceptance, Precedent, Increments when more than one slice exists, Appetite when the work exceeds a day. |
| large | No precedent covers the core of the intent, or the feature opens a new area. | medium, plus Evidence, Terms when needed, Directions. |
| covered | Every element of the intent, read literally, already ships. | Outcome, Precedent, Open questions. |

A small spec is dispatchable as a task on its own. Its Scenarios are the Scope and its Out of scope is the boundary.

A covered spec records that the intent already ships and asks what the intent adds. Its Outcome states where the person finds the shipped behavior, its Precedent table shows the coverage, and its one question offers the readings the PM found beyond the literal intent. It carries no Scenarios, because scenarios describe behavior the engineer builds. When the person's answer names an addition, the PM resizes the spec for that addition alone.

## The line

Every sentence in a spec survives a behavior-preserving refactor. A sentence a refactor could falsify names a mechanism, and it moves to the engineer's design.

> Prefer: "While a thread is muted, a new message in it does not notify the person."
> Over: "The notifier checks a `muted_until` column before sending."

## Sections

Sections appear in this order. A section the size does not require is absent, never empty.

### Outcome

One paragraph, at most six sentences, from the person's perspective. It names who the person is, what they do, and what they get. It uses no product internals.

> Prefer: "A person who is done with a busy thread mutes it for a week. New messages in it stop notifying them, and the thread drops out of the unread count. After a week it returns on its own."
> Over: "Add a mute feature to the inbox with a duration setting."

### Scenarios

Behaviors as Given / When / Then, one per named scenario, ordered by how often they happen. Include an unwanted-behavior scenario whenever one exists. A scenario names what the person observes, never a component.

```
### Mute a thread
Given a thread with unread messages
When the person mutes it for a week
Then new messages in it do not notify them
And the thread leaves the unread count
```

### Out of scope

Bullets naming what stays out and where the work stops. A spec without a boundary grows during implementation.

> Prefer: "- Muting a person across threads. This spec mutes one thread."
> Over: a section that only restates what is in scope.

### Evidence

Who pays for the gap today and what it costs them. It links the threads, issues, or PRs where the gap bit. When the person filing the intent is the only user, one line saying so is the whole section.

### Terms

Words the spec uses that [docs/concepts/](docs/concepts/index.md) does not carry. One line per term, and that term everywhere below. A term concepts does carry links to its entry on first use instead.

### Acceptance

One checklist item per scenario, observable from outside, each naming what proves it: a committed test or a one-time check against the finished branch. The rule is the [task spec rule](docs/authoring/github-issues-task-spec.md#body).

### Appetite

One line: the time the person wants to spend, stated as a budget and not as an estimate. The default is a project setting. The PM proposes and the person owns it.

### Increments

Slices a person can use, in shipping order. The first slice lists its scenarios by name. Each later slice is one line, and it is expanded into scenarios when the slice before it ships.

### Precedent

A table of the intent's elements against the codebase.

| Element | Precedent | Covered |
| --- | --- | --- |
| mute for a duration | `rome_apps/inbox` snooze (#312) | yes |
| leave the unread count | none | no |

The count of uncovered elements is the input to Size.

### Directions

Two or three rough directions, each at breadboard level: the places the person goes, the affordances they use there, and the connections between places. No layout, no components. One direction is marked chosen. Each other direction carries one line naming its tension.

### Decisions

Every choice the PM made, one row each.

| Id | Question | Chosen | Why | Owner | Status |
| --- | --- | --- | --- | --- | --- |
| D1 | Does the person's own reply unmute the thread? | No | Mute is about others. Matches snooze. | person | assumed |

- Owner is `person` when only the person can own the choice, otherwise `engineer`.
- Status is `assumed` when the PM chose, `asked` when the choice is in Open questions, `confirmed` when the person answered or edited, `revised` when implementation changed it. A revised row keeps its original text and adds the revision below it.
- A choice appears once. A choice in Open questions is a Decisions row with status `asked` and an empty Chosen cell, never an `assumed` row with a recommended answer.
- An `engineer` decision may be revised during implementation without asking. A `person` decision is revised only by the person.

### Open questions

At most three, each answerable by picking an option, with the recommended option first. The section is empty when the spec is ready, and an empty section is removed.

## Ready

A spec is ready when all of these hold:

1. Open questions is absent.
2. The person confirmed the Outcome paragraph, by saying so or by editing it. A later change to the paragraph that only restates a decision the person confirmed keeps the confirmation.
3. Every scenario has an Acceptance item, or the size is small.
4. Every `person` decision has status `confirmed`, or the person saw it in the report and did not object.
5. No sentence names a mechanism.

Ready means the engineer starts from the file alone.

A spec is dropped when the person withdraws the intent. The header records the reason in one line under Status, and the file stays on the branch as the record of what was found.
