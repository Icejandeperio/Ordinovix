-- Hand-written follow-up to the generated 0000_init.sql: the two things drizzle-kit cannot express.
-- Like every migration once it is on main, this file is never edited; a change is a new migration.

-- Full-text search (BACKEND_PLAN section 6). The repository layer writes a row here in the same batch as the change it
-- indexes. client_id is the column the helper filter is applied on.
CREATE VIRTUAL TABLE search_index USING fts5 (
  org_id UNINDEXED,
  entity UNINDEXED,
  entity_id UNINDEXED,
  client_id UNINDEXED,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Activity is insert-only: the database itself refuses an update or a delete.
CREATE TRIGGER activity_no_update BEFORE UPDATE ON activity BEGIN SELECT RAISE(ABORT, 'activity is insert-only'); END;
--> statement-breakpoint
CREATE TRIGGER activity_no_delete BEFORE DELETE ON activity BEGIN SELECT RAISE(ABORT, 'activity is insert-only'); END;
