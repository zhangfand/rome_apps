import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import { TYPOGRAPHY_ROLES } from "./typography-roles.js";

/**
 * tailwind-merge knows Tailwind's stock theme scales and nothing else. Register
 * Rome's additions so custom typography roles stay out of the text-color group
 * and numbered radius utilities still yield to a caller's shape override.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["4", "8", "12", "16"],
      text: TYPOGRAPHY_ROLES,
    },
  },
});

/**
 * Merge conditional class names, letting later Tailwind utilities win over
 * earlier ones in the same group. Every kit component composes its variants
 * through this, and consumers use it to override those variants from the
 * outside — so it is part of the public surface, not an internal helper.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
