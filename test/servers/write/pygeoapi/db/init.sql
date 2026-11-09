-- SPIKE seed: two geometry tables
CREATE EXTENSION IF NOT EXISTS postgis;

-- editable in pygeoapi config
CREATE TABLE places (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  kind    TEXT,
  pop     INTEGER,
  geom    geometry(Point, 4326) NOT NULL
);
INSERT INTO places (name, kind, pop, geom) VALUES
  ('Leuven',    'city', 102000, ST_SetSRID(ST_MakePoint(4.7005, 50.8798), 4326)),
  ('Brussels',  'city', 1222000, ST_SetSRID(ST_MakePoint(4.3517, 50.8503), 4326)),
  ('Ghent',     'city', 265000, ST_SetSRID(ST_MakePoint(3.7174, 51.0543), 4326)),
  ('Heverlee',  'town', 22000,  ST_SetSRID(ST_MakePoint(4.6918, 50.8636), 4326));

-- read-only in pygeoapi config
CREATE TABLE roads (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  lanes   INTEGER,
  geom    geometry(LineString, 4326) NOT NULL
);
INSERT INTO roads (name, lanes, geom) VALUES
  ('E40 Leuven-Brussels', 6, ST_GeomFromText('LINESTRING(4.7005 50.8798, 4.5 50.87, 4.3517 50.8503)', 4326)),
  ('E40 Brussels-Ghent',  6, ST_GeomFromText('LINESTRING(4.3517 50.8503, 4.0 50.95, 3.7174 51.0543)', 4326)),
  ('N3 Leuven-Tervuren',  2, ST_GeomFromText('LINESTRING(4.7005 50.8798, 4.6 50.83, 4.51 50.82)', 4326));
