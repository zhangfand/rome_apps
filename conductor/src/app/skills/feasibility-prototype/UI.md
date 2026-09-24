# UI prototype

Several structurally different variants on one route, switchable from a floating bar. Use it when the question is what something should look like or how a person moves through it. Examples: a connection flow in Settings, where a one-time code appears, how degraded and reconnect states read.

## Host

Mount the variants inside the existing page they belong to, with its real header, navigation, data, and density. A variant alone on an empty route looks fine and hides the problems. Create a throwaway route, following the app's routing convention with `prototype` in its path, only when no existing page could host it.

## Build

1. Write the plan in one line at the top of the switcher file, for example: "Three variants of the Slack connection card on `/settings`, switchable via `?variant=`."
2. Default to three variants, never more than five. They must differ in layout, hierarchy, or primary affordance, not just colour or copy. If two come out alike, redo one with an explicit constraint such as "no card grid".
3. Keep the page's data fetching. Swap only the rendered subtree on `?variant=`. Point any mutation at a stub; this question is not about the backend.
4. Add a fixed bottom-centre switcher: previous arrow, current variant key and name, next arrow. The arrow keys cycle too, except while an input is focused. It updates the URL so variants can be shared and survive a reload. It is visually distinct from the design and hidden in production builds.
5. In a Rome app, use the app's existing web stack and `@rome-os/ui` components, and run it through the app's dev or install path so the person opens it at `/apps/<appId>/...`.

## Evidence

A screenshot of each variant and the person's pick. Feedback such as "B's header with C's list" is the real answer; record it in those words.

## Avoid

- Sharing a layout component across variants
- Promoting variant code into production as-is: it was written without tests or error handling
