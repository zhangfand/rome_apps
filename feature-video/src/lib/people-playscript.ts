// The People walkthrough: the playscript the app seeds, and the one document
// known to record end to end, so the checker's tests hold it up as the shape a
// sound playscript has.

import type { PlayscriptDoc } from "./types.js";
import { END } from "./types.js";

export const PEOPLE_PLAYSCRIPT: PlayscriptDoc = {
  targets: {
    "the bond filter": { role: "radiogroup", name: "Filter people by bond level" },
    "the Unknown chip": { within: "the bond filter", role: "radio", name: "Unknown" },
    "the All chip": { within: "the bond filter", role: "radio", name: "All", exact: true },
    "the View switch": { role: "radiogroup", name: "View" },
    "the page title": { role: "heading", name: "People", exact: true },

    "Jules's name": { text: "Jules Marchetti", exact: true },
    // The innermost row element that holds the display name.
    "Jules's row": { css: "div", has: { text: "Jules Marchetti", exact: true }, last: true },
    "Jules's Create button": {
      within: "Jules's row",
      role: "button",
      name: "Create",
      exact: true,
    },
    "the Name field": { label: "Name" },
    "the create form": { xpath: "//label[normalize-space()='Name']/ancestor::form[1]" },
    "the Bond level select": { role: "combobox", name: "Bond level" },
    "the Inner circle option": { role: "option", name: "Inner circle" },
    "the Create profile button": { role: "button", name: "Create profile" },

    "Ray's row": { role: "button", name: "Ray Oster" },
    "Ray's name": { role: "heading", name: "Ray Oster" },
    "the Today heading": { role: "heading", name: "Today" },
    "the Account switch": { role: "radiogroup", name: "Account" },
    "the WhatsApp account": { within: "the Account switch", role: "radio", name: "WhatsApp" },
    "the All accounts": { within: "the Account switch", role: "radio", name: "All" },
    "the People back button": { role: "button", name: "People", exact: true },

    "the composer": { label: "Message text" },
    // Two levels up from the field: its row, and the card that holds the row.
    "the composer card": { xpath: "//*[@aria-label='Message text']/../.." },
    "the target menu": { role: "button", name: "WhatsApp ·" },
    "the WhatsApp menu item": { role: "menuitem", name: "WhatsApp" },
    "the outbox": { role: "list", name: "Outbox" },
    "the landed message": { text: "Bring the spare on Thursday" },
  },
  beats: [
    {
      id: "hook",
      line: "This is People. Everyone who has said something to Rome, newest first, on every channel at once.",
      cues: [{ on: "This is People", do: [["show"]] }],
    },
    {
      id: "hook-count",
      line: "The one number on the page is the senders still waiting on your decision.",
      cues: [
        {
          on: "The one number",
          do: [
            ["hover", "the Unknown chip"],
            ["focus", "the Unknown chip", 1.6],
          ],
        },
      ],
    },
    {
      id: "recognize",
      line: "A stranger writes in. Rome does not guess who they are. You decide, right on the row, with what they said in front of you.",
      cues: [
        {
          on: "A stranger writes in",
          do: [["show"], ["click", "the Unknown chip"], ["wait", "Jules's name"]],
        },
        {
          on: "Rome does not guess",
          do: [
            ["hover", "Jules's row"],
            ["focus", "Jules's row", 1.4],
          ],
        },
        {
          on: "You decide",
          do: [
            ["click", "Jules's Create button"],
            ["wait", "the Name field"],
            ["focus", "the create form", 1.5],
          ],
        },
      ],
    },
    {
      id: "recognize-bond",
      line: "Give them a name and a bond level, and from now on Rome remembers them as one person, whichever channel they use.",
      cues: [
        { on: "a bond level", do: [["click", "the Bond level select"]] },
        { on: "and from now on", do: [["click", "the Inner circle option"]] },
        {
          on: "Rome remembers them",
          do: [
            ["click", "the Create profile button"],
            ["gone", "Jules's name"],
            ["hover", "the page title"],
          ],
        },
        {
          on: "whichever channel",
          do: [["show"], ["click", "the All chip"], ["wait", "Ray's row"]],
        },
      ],
    },
    {
      id: "dossier",
      line: "One person, one history. Ray reaches you on Telegram and WhatsApp, and both land on the same page, in order.",
      cues: [
        {
          on: "One person",
          do: [
            ["click", "Ray's row"],
            ["wait", "Ray's name"],
            ["wait", "the Today heading"],
          ],
        },
        { on: "Ray reaches you", do: [["focus", "Ray's name", 1.5]] },
        { on: "both land on the same page", do: [["focus", "the Today heading", 1.3]] },
      ],
    },
    {
      id: "dossier-scope",
      line: "Scope to a single account when you need to.",
      cues: [
        { on: "Scope", do: [["focus", "the Account switch", 1.4]] },
        { on: "a single account", do: [["click", "the WhatsApp account"]] },
        { on: END, do: [["click", "the All accounts"]] },
      ],
    },
    {
      id: "reply",
      line: "Reply without leaving. The composer always says which account it is about to write to, so nothing goes somewhere you did not pick.",
      cues: [
        { on: "Reply without leaving", do: [["focus", "the composer card", 1.5]] },
        { on: "The composer always says", do: [["click", "the target menu"]] },
        { on: "about to write to", do: [["click", "the WhatsApp menu item"]] },
        {
          on: "so nothing goes",
          do: [
            ["click", "the composer"],
            ["type", "Bring the spare on Thursday, I owe you a coffee."],
          ],
        },
      ],
    },
    {
      id: "reply-lands",
      line: "Rome shows the message as in flight until it actually lands on the timeline. Then it is history like everything else.",
      cues: [
        {
          on: "Rome shows",
          do: [
            ["press", "Enter"],
            ["wait", "the outbox"],
            ["focus", "the outbox", 1.4],
          ],
        },
        {
          on: "until it actually lands",
          do: [
            ["gone", "the outbox"],
            ["wait", "the landed message"],
            ["focus", "the landed message", 1.4],
          ],
        },
      ],
    },
    {
      id: "close",
      line: "People. Every channel, one list of humans. And every decision about who is who stays yours.",
      cues: [
        {
          on: "People",
          do: [["show"], ["click", "the People back button"], ["wait", "the View switch"]],
        },
      ],
    },
  ],
};
