-- Third (editable) table stored in EPSG:3857, added to check whether geometry
-- updates behave differently when the layer CRS is not EPSG:4326.
CREATE TABLE public.towns_3857 (
  id    serial PRIMARY KEY,
  name  varchar(100) NOT NULL,
  geom  geometry(Point, 3857)
);
INSERT INTO public.towns_3857 (name, geom) VALUES
  ('Mechelen', ST_Transform(ST_SetSRID(ST_MakePoint(4.4777, 51.0259), 4326), 3857)),
  ('Bruges',   ST_Transform(ST_SetSRID(ST_MakePoint(3.2247, 51.2093), 4326), 3857));
