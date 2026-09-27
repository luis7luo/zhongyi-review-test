# Multisubject Candidate Freeze — 2026-09-27

## Scope and Authority

Canonical local candidates: `work/zhongyi-review-test` and sibling `work/zhongyi-review-trial`.
Full: 中药 374 / 方剂 277 / 穴位 99 / 病证选穴 64 = 814.
Trial: 中药 37 / 方剂 37 / 穴位 20 / 病证选穴 17 = 111.
These are local candidates, not a claim about any live deployment.

Freeze the HTML and current JSON artifacts directly. Do NOT run
`work/build_zhongyi_review_test.py` or older extraction/generation pipelines over
these candidates. Their templates do not preserve the Phase 1–3 frontend fixes.
`candidate-manifest.json` pins SHA-256 values. No automatic baseline acceptance:
review changes, rerun all checks, then deliberately update the manifest.

No activation/payment changes, medical edits, regeneration, push or deployment
are part of this freeze. Existing paid V1, free Zhongyao trial and production
infrastructure are outside its scope.

## Accounting for Pre-existing Uncommitted Work

Audited against parent `8b0b3e0cace56810967bbd303734e6c71f3dc872`:

| File | Classification | Disposition |
| --- | --- | --- |
| `data/review_items.json` | Previously approved corrections | Data-only commit `52a869b46b1ce37b375064c543b2e264c1cea85c` |
| `data/extraction_report.json` | Generated current evidence | Include in release-hardening commit after count validation |
| `data/correction_report.json` (previously untracked) | Historical before/after evidence | Include unchanged; preserve historical 826 baseline |
| `README.md` | Generated current documentation | Preserve corrected counts; replace unsafe regeneration instruction with artifact freeze guidance |

No unrelated/unexplained working-tree files were found in the full repository.
The old tracked dataset exactly matches the archived pre-correction JSON.
The correction report exactly accounts for 118 changed same-ID rows, 19 removed
IDs and 7 added IDs (net minus 12). Those are historical changes being committed,
not new ID changes in this phase. Seven additions correspond to approved OCR
name corrections; actual scope reduction is one excluded formula plus eleven
redundant disease cards.

Evidence: copies in `docs/evidence/` (JSON byte-preserved; Markdown copies have
only trailing hard-break spaces removed for diff hygiene; originals untouched), plus
`data/correction_report.json`. All 334 changed extra-field values checked against
matched old/new rows were explained: 83 by recorded text replacements, 236 by
normalized text present in the supplied Word files, 8 by recorded parallel-plan
labels, and 7 by previously recorded headache repairs / cross-page merges.
The latter seven were compared to the existing literal repair record (read via
AST without executing the generator) or merged old fields. Formal answer changes
match the before/after report; seven herb corrections match the correction table.
This is provenance/structure verification, not a fresh medical correctness audit.

滚痰丸 remains excluded: the existing evidence lacks independent 功用/主治.
Recorded cross-page merges and four paired alternatives remain intact. No source
Word/PDF was modified. Historical reports mentioning 826 remain historical;
the current full-page badge is corrected to 814 and trial full-count fallbacks
to 277 formulas / 64 disease-selection items.

## Verification

From the workspace root:

```sh
node --test work/zhongyi-review-test/*.test.mjs
TCM_REVIEW_DIR=work/zhongyi-review-trial node --test work/zhongyi-review-test/mastery-review.test.mjs
python3 -B work/validate_tcm_review_data.py
node work/zhongyi-review-test/verify_candidate.mjs
node work/zhongyi-review-test/verify_candidate.mjs work/zhongyi-review-trial
git -C work/zhongyi-review-test diff --check
```

The verifier is read-only and checks artifact hashes, unique IDs, scope counts,
report counts, edition badge, seven herb corrections, exclusions, merges and the
open content gate. Regression tests exercise displayed summary counts, including
the trial fallback, alongside Phase 1–3 behavior. Runtime source-summary text is
not a substitute for the manifest checks.

Freeze verification: 154 full/release tests + 146 trial tests = 300 passing.
The two stale UI metadata cases were observed failing before correction.
Both HTML scripts passed syntax checks; data validation, semantic candidate
checks and diff checks passed. Data SHA-256 values are unchanged across this
phase, including IDs and all medical fields. Phase 1–3 logic is unchanged.

## Trial Checkpoint and Version Control

Private checkpoint: `work/private-checkpoints/multisubject-phase4-20260927/`.
Its `checkpoint.json` records creation UTC time, full repository commit and the
exact SHA-256 of every copied file. It contains only an explicit allowlist:
trial HTML/data/README/`.nojekyll`, full candidate files, tests/verifier and the
external read-only data validator/correction records needed to rerun checks.
No `.vercel`, `.env`, Git credential configuration, activation codes or secrets.
Directory mode 0700; copied files 0600. Keep immutable; create a new checkpoint
for any subsequent candidate instead of overwriting this one.

Reproduce by copying the checkpoint's `work/` tree to a clean private directory,
checking every SHA-256 in `checkpoint.json`, then running the commands above
(the Git diff command requires a repository and is not applicable to a plain
checkpoint). No generator or package installation is required (Node + Python).

Before final release, choose deliberately:

- A: dedicated trial Git repository for independent edits/releases; recommended
  if trial development continues. Not initialized by this phase.
- B: immutable generated-release artifact with checkpoint/manifest and explicit
  full-source relationship. Adequate for this validation candidate, but requires
  a new checkpoint for every approved change; no unrecorded manual trial edits.

## Open Content Gate

Item: `zhenjiu-point-044-少泽`; category 六、手太阳小肠经.
Fields: `extra.主治` and the mirrored `primaryAnswer`, containing
“急症、热证：昏迷、中风、癫狂、痣疯、热病”.
Present in full only; not in the 111-item trial. The reverse prompt is positioning
text and does not contain this term.

Source: `27学霸笔记—针灸与人文_9-70.docx`, document XML table 10, row 2
(one-based). Printed page within that page-range file is NOT established; table
index is not a page number. Require the actual source-page image / reliable
original layout confirmation before proposing a correction. Do not infer from
model medical knowledge. This phase leaves the text unchanged.

Technical freezing may proceed, but final public release must explicitly resolve
or formally disposition this content gate. No automatic exclusion/edit is approved.

## Remaining Acceptance

- Real phone/tablet browser acceptance has not been performed for this candidate.
- Resolve the source-page content gate and choose the trial version-control policy.
- Recheck hashes and regression results on the exact files proposed for release.
- Do not infer medical completeness, paid access readiness or commercial hosting
  approval from a passing technical candidate check.
