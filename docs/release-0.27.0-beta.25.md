# 0.27.0-beta.25

- Home shelf cards finish just below their own titles. A neighbouring two-line title no longer adds an empty grey strip below shorter titles.
- Selected cards in Jump back in clip their label gradient and input badge to the rounded artwork corners, while keeping the full selection outline visible.
- Removed the deprecated custom on-screen keyboard, including its dialog, layout, key handlers and controller shortcuts. Controller search, controller activation of text fields, and touch/pen text entry now request the native Windows touch keyboard. Dynamic text fields, textareas, email, URL, telephone and password fields use the same path. Physical keyboard typing remains available.

Validation: visual checks at 1280×800 and 1920×1080; search, touch, pen and controller text-entry checks; live Windows InputPane request from a focused Electron text field succeeded. Handheld-specific keyboard placement is managed by Windows and has not been tested on the physical handheld.
