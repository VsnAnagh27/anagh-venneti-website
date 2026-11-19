CREATE TABLE IF NOT EXISTS document_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_name TEXT NOT NULL,
  document TEXT NOT NULL CHECK (document IN ('cv', 'thesis')),
  accessed_at TEXT NOT NULL,
  page TEXT
);
CREATE INDEX IF NOT EXISTS idx_document_access_time ON document_access(accessed_at DESC);
