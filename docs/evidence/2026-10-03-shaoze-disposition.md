# 少泽 source-content disposition, 2026-10-03

Item: `zhenjiu-point-044-少泽`; full only, absent from the 111-item trial.
Authority: user's explicit 2026-10-03 release instruction to remove the existing
`痣疯` indication without guessing a replacement or changing other indications.

## Source inspected

- Original supplied PDF: `27学霸笔记—针灸与人文.pdf` (URL-encoded filename on disk).
- PDF SHA-256: `10f402dff93901de5a244285424d2d31330566302870758779309d70b2b0b0fb`.
- Rendered PDF page 16 (one-based), printed book page 641, 六、手太阳小肠经,
  少泽 row, 主治 column, entry 3, between 癫狂 and 热病.
- Reviewed the complete rendered page and an enlarged render directly from the PDF.
- The original image visibly contains a suspicious printed indication at this
  location, so the extra indication itself was not invented by extraction.
  However, the first glyph cannot confidently be transcribed as 痣 from this scan.
  The user's supplied transcription and converted Word/current dataset say 痣疯.
  We do NOT claim independent visual confirmation of those exact two characters,
  and do NOT infer a replacement from medical knowledge or OCR.
- Source/Word files and historical audit records are unchanged. Full copyrighted
  PDF and page renders remain private, not uploaded to the public repository.

## Approved minimal omission

Before: `昏迷、中风、癫狂、痣疯、热病`

After: `昏迷、中风、癫狂、热病`

Remove only `痣疯、` (the term and its redundant list separator) from
`extra.主治` and the mirrored `primaryAnswer`. All remaining source-derived text,
punctuation, current IDs, reverse prompt and other items stay byte-identical.
No replacement, normalization or new medical claim was introduced.

Final 主治:

> 1.肩臂后侧痛，小指麻木疼痛2.乳疾：乳痈、乳少、产后缺乳3.急症、热证：昏迷、中风、癫狂、热病4.头面五官病：头痛、目翳、咽喉肿痛、耳聋耳鸣

This closes the production inclusion gate through the explicitly approved
omission, NOT through a claim that the source typo has been medically corrected.
The exact original glyph remains uncertain in provenance history. Restoring or
replacing the omitted term requires separate source-backed review and approval.

## Regression evidence

Two targeted tests failed before the data edit (literal answer and approved-only
byte transformation). The latter restores the two omitted substrings in memory
and requires the complete old dataset SHA-256, proving no other data/IDs changed.
The release verifier additionally rejects reintroduction even if a checksum is
updated. Historical evidence may retain the term; current question data may not.
