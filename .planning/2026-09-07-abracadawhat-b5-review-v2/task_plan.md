# Abracadawhat B5 Reviewer Fixes v2

## Goal

Fix all reported B5 High/Medium findings in a separate commit without implementing Stage C or D.

## Phases

- [complete] 1. RED adversarial story tier and dialog source tests
- [complete] 2. RED compiled desktop/mobile dialog interaction tests
- [complete] 3. GREEN focus trap, in-dialog actions, and tier lookup
- [complete] 4. Serial focused/full/build/A4/B5 verification
- [complete] 5. Append B5 report, review staged files, and commit

## Constraints

- Strict TDD with observed behavior failures before production edits.
- Dialog trap includes every actually focusable visible control, including `summary`.
- Open recap contains host/nonhost actions; persistent A4 bar remains available only after close to avoid duplicate accessible names.
- Rematch remains retry-safe and does not close the recap.
- Story tiers remain internal and no Stage C/D work is added.

## Errors

| Error | Attempt | Resolution |
|---|---:|---|
| Browser expected close to refocus after host state changed without reopening the dialog | 1 | Keep initial-open focus assertion separate and explicitly focus close before the later Escape path. |
| Existing A4 expected close to be the dialog's only focusable control | 2 | Update A4 to assert close -> contextual rematch -> contextual return -> close and reverse wrap. |
| Source regex expected bare `visibility` instead of `style.visibility` | 3 | Correct test pattern; browser tests remain the behavioral proof. |
