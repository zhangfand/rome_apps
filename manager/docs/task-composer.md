# Task detail composer

The detail page includes a Message Manager composer pinned to the bottom of the task view while its content scrolls. The old header “Discuss in chat” button is removed. The dock stays within the app content width, includes bottom safe-area padding, and reserves space at the end of History so the final entries remain readable.

- **Enter / Send reply:** POST the draft to the guardian-only `tasks/:id/reply` route, which calls existing `manager:reply` and its normal reconciliation path. No chat is created. Successful sends silently clear the draft and refresh task detail/history; no success acknowledgment is shown.
- **Shift+Enter / Start chat:** open a new `manager:manager` conversation, with the task ID and the draft as its first message.
- **Alt+Enter:** insert a newline at the selection.
- Empty submissions, held-key repeats and IME candidate confirmation do not send. Both send controls lock while submitting, with a synchronous guard against double submissions. Failed requests preserve the draft and show an inline error.
- Completed/cancelled tasks cannot receive one-shot replies; chat stays available for discussion. API enforcement also rejects non-guardian callers, invalid bodies, oversized payloads, missing tasks and closed tasks.

Verification: typecheck and all 322 tests passed. Installed-app browser checks used intercepted writes (no real replies or chats): Enter sends only a task reply; Shift+Enter creates a Manager session and submits the contextual first message; error retains draft; duplicate submissions and IME confirmation are blocked; Alt+Enter inserts a newline. Composer fits a 390px mobile viewport. Pinned position was verified at the top, middle, and end of the full-page view at desktop and mobile widths.

## Compact send control

The composer now has one icon-only send button with a tooltip and an adjacent chevron. The menu switches the click action between Send reply and Start chat, shows the active choice and both shortcuts, and lists Alt+Enter for a newline. Keyboard mappings stay fixed regardless of the selected click mode. Closed tasks default to chat, with reply disabled in the menu. Removed the visible heading and explanatory subtext; the input retains its accessible label. Verified mode switching, tooltip/shortcut text and intercepted click/keyboard routing in the installed browser; typecheck and 322 tests passed.

## Inline auto-growing input

Send/mode controls sit inside the right edge of the input, vertically centered, shown only for a nonblank draft. The empty input is one line; native field sizing grows upward to six visible lines, then scrolls internally. Right padding keeps typed text clear of the controls. Verified empty → typed → multiline → overflow → cleared at desktop and 390px mobile widths: 1/3/6/8 explicit lines measured 38/78/138/138px, with controls contained inside the field and its bottom edge stationary. Typecheck and 322 tests pass.

Controls are vertically centered inside the field (not bottom-offset), with equal top/bottom gaps at both one and six lines.
