-- Seed data for the ldproxy CRUD spike.
-- Two geometry tables:
--   poi   (points)  -> exposed as an EDITABLE collection (CRUD enabled)
--   roads (lines)   -> exposed as a READ-ONLY collection (CRUD disabled)
-- Both live in the same feature provider, which has datasetChanges.mode: CRUD.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE poi (
  id          serial PRIMARY KEY,               -- auto-generated -> POST on /items is offered
  name        text NOT NULL,
  category    text,
  rating      integer,
  updated_at  timestamptz NOT NULL DEFAULT now(), -- mapped with isLastModified: true
  geom        geometry(Point, 4326) NOT NULL
);

CREATE TABLE roads (
  id          serial PRIMARY KEY,
  name        text NOT NULL,
  lanes       integer,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  geom        geometry(LineString, 4326) NOT NULL
);

-- Keep updated_at current on every write, whatever the client sends.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poi_touch   BEFORE INSERT OR UPDATE ON poi   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER roads_touch BEFORE INSERT OR UPDATE ON roads FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

INSERT INTO poi (name, category, rating, geom) VALUES
  ('Leuven Town Hall',    'landmark', 5, ST_SetSRID(ST_MakePoint(4.7010, 50.8789), 4326)),
  ('Central Library',     'library',  4, ST_SetSRID(ST_MakePoint(4.7067, 50.8770), 4326)),
  ('Station Leuven',      'transport',3, ST_SetSRID(ST_MakePoint(4.7155, 50.8812), 4326)),
  ('Arenberg Castle',     'landmark', 4, ST_SetSRID(ST_MakePoint(4.6844, 50.8636), 4326));

INSERT INTO roads (name, lanes, geom) VALUES
  ('Bondgenotenlaan', 2, ST_SetSRID(ST_GeomFromText('LINESTRING(4.7010 50.8789, 4.7155 50.8812)'), 4326)),
  ('Naamsestraat',    1, ST_SetSRID(ST_GeomFromText('LINESTRING(4.7010 50.8789, 4.6844 50.8636)'), 4326)),
  ('Tiensestraat',    1, ST_SetSRID(ST_GeomFromText('LINESTRING(4.7010 50.8789, 4.7090 50.8740)'), 4326));

-- Dedicated DB role for ldproxy (needs write on both tables; read-only-ness of
-- "roads" is enforced by ldproxy configuration only, not by the database).
CREATE ROLE ldproxy LOGIN PASSWORD 'ldproxy';
GRANT SELECT, INSERT, UPDATE, DELETE ON poi, roads TO ldproxy;
GRANT USAGE, SELECT ON SEQUENCE poi_id_seq, roads_id_seq TO ldproxy;
GRANT SELECT ON spatial_ref_sys, geometry_columns TO ldproxy;
