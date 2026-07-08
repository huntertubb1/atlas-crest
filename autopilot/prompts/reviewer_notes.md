Audit {ausum_id} ({insured}) came back "Returned" from QC review in AUSUM.
Extract the reviewer's correction notes VERBATIM so they can be pasted into
a digest email.

Read these two files (Read tool only — you have no other tools and need
none):
1. {text_path} — text dump of the audit detail page
2. {screenshot_path} — full-page screenshot of the same page (use this if
   the text dump doesn't contain the notes; they sometimes render in a
   panel the text dump mangles)

Respond with ONLY the reviewer/QC note text, word for word, one note per
line (prefix each with "- "). Include reviewer name and date if shown.
If you genuinely cannot find any reviewer notes, respond with exactly:
NO_NOTES_FOUND
