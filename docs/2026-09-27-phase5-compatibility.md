# Phase 5: Old-ID Compatibility and Source Evidence

Local only. Baseline: `35b3bb439980ce97b65af6a827ece02bf3135fd7`.
No data regeneration, medical edits, current ID changes, deployment or paid-site changes.

## Evidence and Mapping

The complete 19 removed / 7 added IDs are in `data/correction_report.json`.
The prior dataset remains available in Git before the data-freeze commit.
`docs/evidence/tcm_corrections.json` explicitly records OCR substitutions,
cross-page merge names, preserved parallel schemes and 滚痰丸 exclusion.
The following is a fixed allowlist, not a name-matching heuristic at runtime.

| Old ID | Current ID |
| --- | --- |
| fangji-189-大黄廑虫丸 | fangji-189-大黄䗪虫丸 |
| fangji-242-萆薛分清饮 | fangji-242-萆薢分清饮 |
| fangji-266-葛花解醒汤 | fangji-266-葛花解酲汤 |
| zhenjiu-point-050-颧醪 | zhenjiu-point-050-颧髎 |
| zhenjiu-point-068-肩醪 | zhenjiu-point-068-肩髎 |
| zhenjiu-point-073-瞳子醪 | zhenjiu-point-073-瞳子髎 |
| zhenjiu-treatment-023-泄泻-急性泄泻 | zhenjiu-treatment-021-泄泻-急性泄泻 |
| zhenjiu-treatment-024-泄泻-慢性泄泻 | zhenjiu-treatment-022-泄泻-慢性泄泻 |
| zhenjiu-treatment-028-癃闭-实证 | zhenjiu-treatment-026-癃闭-实证 |
| zhenjiu-treatment-029-癃闭-虚证 | zhenjiu-treatment-027-癃闭-虚证 |
| zhenjiu-treatment-032-痹证 | zhenjiu-treatment-031-痹证 |
| zhenjiu-treatment-050-炸腮 | zhenjiu-treatment-050-痄腮 |
| zhenjiu-treatment-051-疙腮 | zhenjiu-treatment-050-痄腮 |
| zhenjiu-treatment-054-扭伤 | zhenjiu-treatment-053-扭伤 |
| zhenjiu-treatment-055-扭伤 | zhenjiu-treatment-053-扭伤 |
| zhenjiu-treatment-056-扭伤 | zhenjiu-treatment-053-扭伤 |
| zhenjiu-treatment-058-项痹 | zhenjiu-treatment-057-项痹 |
| zhenjiu-treatment-075-胆道蛔虫症 | zhenjiu-treatment-074-胆道蛔虫症 |

Six renames and twelve merged/renamed source IDs map to fifteen current targets.
All seven added IDs are covered. `fangji-253-滚痰丸` has NO replacement.
Four parallel-scheme pairs remain separate; no fuzzy or cross-subject matching.

## Migration Contract

- Run only after the complete core JSON passes validation, before initial review rendering.
- Restrict mapping to targets actually present in this edition and their original subject/module storage key.
- Current trial contains none of these targets: its old records are left untouched, not imported from full.
- Map mastered, review and favorite arrays; collapse duplicate mapped IDs. Preserve historical done/know counters and all unrelated fields/keys.
- Only overlaps involving migrated mastery/review IDs are reconciled. With no timestamp evidence, review wins conservatively; no claim that the last action is known.
- A single custom answer, or identical custom answers for one target, transfers to that target. Remove only the successfully transferred old aliases to prevent resurrection after restore.
- If values conflict, preserve every old/current answer unchanged. Store the affected old IDs in `__legacyUnmigratedIds` within the EXISTING custom-answers JSON key. No new localStorage key is created. This small hold list survives later edits/restores and prevents silently choosing a different legacy answer on a future refresh. Conflict resolution remains manual; no conflict-management UI was added.
- Unknown IDs, 滚痰丸, out-of-edition targets and held custom conflicts remain explicitly unmigrated and are not deleted.
- Per-key writes use localStorage's single-key replacement; failures preserve that original key. No global migration-complete marker is used. Successfully migrated keys are idempotent; failed writes retry on a subsequent visit. If storage is unavailable, migration is not claimed successful.
- No cross-origin, cross-edition, paid-V1 or backend migration is performed. Existing storage-key names are unchanged.

RED evidence: 74 full-version failures before implementation (trial preservation cases already passed). A second RED test reproduced conflict-answer resurrection after restore and a dependency on unavailable `Object.hasOwn`; both were fixed. The implementation uses the older `hasOwnProperty.call` API instead.
Regression coverage includes all 18 explicit mappings, each state array, custom answers, merges, conflicts, duplicates, restart idempotence, restore, write failure, excluded/unknown IDs, unrelated keys and invalid-core-data gating.

Final automated verification: 236 full/release checks + 228 trial checks = 464
passing. Syntax, diff, data/correction validation and both candidate manifests pass.
Frozen data hashes are unchanged. Real-device acceptance is still pending.

## Source Evidence: 少泽 / 痣疯

Read-only source:
`/Users/luis/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_vsvkin2jwf3e21_80c7/msg/file/2026-07/27学霸笔记—针灸与人文_9-70.docx`

Location: `word/document.xml`, table 10 row 2 (one-based), 主治 column.
The preceding header is 穴位 / 定位 / 主治 / 刺灸法 / 特定穴; the row is 少泽,
followed by 后溪. Printed page within the 9–70 range is not established.

Exact concatenated text of the 主治 cell (including source spaces):

> 1.肩臂后侧痛，小指麻木疼痛2.乳疾：乳痈、乳少、产后缺乳3.急症、热证：昏迷、中风、癫狂、 痣疯、热病4.头面五官病：头痛、目翳、咽喉 肿 痛 、耳聋耳鸣

The supplied Word itself DOES contain “痣疯”; this is not a newly introduced
website typo. A PDF-to-Word conversion is not proof of the intended original
printed character. No replacement is inferred or applied.

Existing project notes all mark it unresolved: `tcm_corrections.json` manualReview,
2026-07-17 audit/summary, and `outputs/zhongyi-multisubject-status-audit-2026-09-27.md`
(its zero-based table 9 is the same table). No approved replacement note was found
in the searched content reports/data/scripts.

Current item `zhenjiu-point-044-少泽` contains it in `extra.主治` and
`primaryAnswer`; full only, not trial. The positioning-only reverse prompt does
not contain it. It remains an OPEN PUBLIC-RELEASE CONTENT GATE requiring source-page
confirmation or explicit release disposition. It does not block technical local
candidate testing; it must not be described as medically verified.

## Freeze and Remaining Gates

Only approved HTML checksums are updated in `candidate-manifest.json`; all data
hashes and semantic checks remain unchanged. The Phase 4 private checkpoint is
immutable. Phase 5 gets a new private checkpoint at
`work/private-checkpoints/multisubject-phase5-20260927/` with source commit, UTC time
and file hashes. Trial remains outside Git; its exact new candidate is checkpointed.

Before release: real-device acceptance with a seeded legacy profile, storage
availability and refresh checks, trial version-control choice, and the source-page
content gate. Conflicting custom answers cannot be automatically resolved.
