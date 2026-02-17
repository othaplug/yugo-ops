-- Remove legacy client message blocks from internal_notes.
-- Before the dedicated messages table, client messages were appended as:
--   ---
--   [YYYY-MM-DD HH:MM:SS] (Client message)
--   message content
-- These are now in the messages table; clean them from internal_notes.

-- Use 's' flag so . matches newline. Remove blocks with separator and at start.
UPDATE moves
SET internal_notes = trim(
  regexp_replace(
    regexp_replace(
      internal_notes,
      E'\n*---\n*\n*\\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\] \\(Client message\\)\n.*?(?=\n\n---|\n---|$)',
      '',
      'gs'
    ),
    E'^\\[\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}\\] \\(Client message\\)\n.*?(?=\n\n---|\n---|$)',
    '',
    'ms'
  )
)
WHERE internal_notes ~ '\[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\] \(Client message\)';
