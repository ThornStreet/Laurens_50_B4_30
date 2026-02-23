-- Add Puerto Rico and U.S. Virgin Islands to tracked states
INSERT INTO states (name, abbr, visited)
VALUES
  ('Puerto Rico', 'PR', false),
  ('U.S. Virgin Islands', 'VI', false)
ON CONFLICT (name) DO NOTHING;
