-- Two geometry tables for the QGIS Server write spike.
-- cities  -> published + Insert/Update/Delete in the project (editable)
-- parcels -> published, no WFS-T capabilities (read-only)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.cities (
  id    serial PRIMARY KEY,
  name  varchar(100) NOT NULL,
  population integer,
  note  text,
  geom  geometry(Point, 4326)
);
INSERT INTO public.cities (name, population, note, geom) VALUES
  ('Leuven',    102000, 'university', ST_SetSRID(ST_MakePoint(4.7005, 50.8798), 4326)),
  ('Brussels', 1222000, 'capital',    ST_SetSRID(ST_MakePoint(4.3517, 50.8503), 4326)),
  ('Ghent',     265000, NULL,         ST_SetSRID(ST_MakePoint(3.7174, 51.0543), 4326)),
  ('Antwerp',   530000, 'port',       ST_SetSRID(ST_MakePoint(4.4025, 51.2194), 4326));

CREATE TABLE public.parcels (
  id     serial PRIMARY KEY,
  owner  varchar(100),
  area_m2 double precision,
  geom   geometry(Polygon, 4326)
);
INSERT INTO public.parcels (owner, area_m2, geom) VALUES
  ('Alice', 1000, ST_GeomFromText('POLYGON((4.70 50.87,4.71 50.87,4.71 50.88,4.70 50.88,4.70 50.87))', 4326)),
  ('Bob',   2000, ST_GeomFromText('POLYGON((4.35 50.84,4.36 50.84,4.36 50.85,4.35 50.85,4.35 50.84))', 4326)),
  ('Carol', 3000, ST_GeomFromText('POLYGON((3.71 51.05,3.72 51.05,3.72 51.06,3.71 51.06,3.71 51.05))', 4326));
