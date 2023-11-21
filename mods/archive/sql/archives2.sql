CREATE INDEX IF NOT EXISTS sig_idx ON archives (sig);
CREATE INDEX IF NOT EXISTS field1_idx on archives (field1);
CREATE INDEX IF NOT EXISTS field2_idx on archives (field2);
CREATE INDEX IF NOT EXISTS field3_idx on archives (field3);
CREATE INDEX IF NOT EXISTS created_at_idx on archives (created_at);
CREATE INDEX IF NOT EXISTS updated_at_idx on archives (updated_at);
CREATE INDEX IF NOT EXISTS owner_idx on archives (owner);
