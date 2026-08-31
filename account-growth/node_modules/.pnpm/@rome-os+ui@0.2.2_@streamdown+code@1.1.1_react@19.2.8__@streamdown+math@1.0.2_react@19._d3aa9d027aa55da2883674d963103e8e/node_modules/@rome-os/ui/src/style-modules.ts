// This module is imported by entries that carry a stylesheet side effect.
// Keeping the declaration in emitted JavaScript's module graph means strict
// downstream TypeScript consumers see it before checking those CSS imports.
declare module "*.css" {}
