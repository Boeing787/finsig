INSERT INTO activities (name)
VALUES ('Design'), ('Consulting'), ('Support'), ('Sandbox test')
ON CONFLICT (name) DO NOTHING;
