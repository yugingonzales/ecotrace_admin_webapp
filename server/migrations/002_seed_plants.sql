-- GENERATED FILE - do not hand-edit.
-- Source:     src/lib/trees.ts  (the authoritative mock inventory)
-- Generator:  server/scripts/generate-seed.mjs
-- Regenerate: node server/scripts/generate-seed.mjs
--
-- Seeds the 23 UEP Catarman trees. Idempotent: keyed on the UNIQUE
-- tree_code column added in migration 001.
--
-- STATUS MAPPING (StatusKey -> plant_status): 1:1 for all four values.
--   The ENUM was widened by migrations 001 and 002 to make this exact, so the
--   map layer's per-status pin colours and counts survive the round-trip.
--   Counts: incident=4, pending=6, unverified=2, verified=11
--
-- planter_name is parked in location_address because the table has no planter
-- column. That reuses a semantically wrong field and is the one line here that
-- should not ship to production. Acceptable for a dev seed only.

INSERT INTO ecotrace_plants
  (tree_code, zone_name, latitude, longitude, planted_date, plant_species, plant_status, verification_count, location_address)
VALUES
  ('TRE-0892','Zone I',12.51010000,124.66790000,'2026-03-12','Narra','verified',1,'Juan Santos'),
  ('TRE-0567','Zone I',12.50980000,124.66810000,'2026-03-15','Molave','incident',0,'Maria Reyes'),
  ('TRE-1204','Zone I',12.50920000,124.66770000,'2026-03-18','Ipil','pending',0,'Carlo Diaz'),
  ('TRE-0341','Zone I',12.51000000,124.66710000,'2026-03-20','Mahogany','verified',1,'Ana Lim'),
  ('TRE-1108','Zone I',12.50940000,124.66710000,'2026-03-25','Kamagong','pending',0,'Sofia Torres'),
  ('TRE-0223','Zone I',12.51050000,124.66760000,'2026-03-28','Narra','verified',1,'Rico Mendoza'),
  ('TRE-0412','Zone I',12.50940000,124.66790000,'2026-04-03','Ipil','verified',1,'Marc Tan'),
  ('TRE-1501','Zone I',12.50970000,124.66730000,'2025-01-15','Narra','verified',1,'Luis Reyes'),
  ('TRE-1502','Zone I',12.51030000,124.66800000,'2025-06-20','Molave','pending',0,'Ria Santos'),
  ('TRE-1503','Zone I',12.50890000,124.66750000,'2025-11-08','Kamagong','verified',1,'Nico Bautista'),
  ('TRE-0783','Zone II',12.51350000,124.66160000,'2026-03-22','Banaba','incident',0,'Ben Cruz'),
  ('TRE-0950','Zone II',12.51280000,124.66170000,'2026-04-01','Molave','incident',0,'Lena Bautista'),
  ('TRE-1056','Zone II',12.51340000,124.66100000,'2026-04-05','Narra','unverified',0,'Donna Uy'),
  ('TRE-0834','Zone II',12.51290000,124.66120000,'2026-04-11','Narra','pending',0,'Chris Ramos'),
  ('TRE-1504','Zone II',12.51320000,124.66140000,'2025-03-05','Ipil','verified',1,'Ella Torres'),
  ('TRE-1505','Zone II',12.51270000,124.66150000,'2025-08-18','Banaba','incident',0,'Mark Dela Cruz'),
  ('TRE-1506','Zone II',12.51300000,124.66110000,'2024-12-01','Mahogany','verified',1,'Sara Lim'),
  ('TRE-0678','Zone III',12.50990000,124.66120000,'2026-04-07','Mahogany','unverified',0,'Kai Lopez'),
  ('TRE-0199','Zone III',12.51070000,124.66120000,'2026-04-09','Banaba','verified',1,'Jess Flores'),
  ('TRE-0455','Zone III',12.51040000,124.66050000,'2026-04-13','Kamagong','verified',1,'Pat Soriano'),
  ('TRE-1320','Zone III',12.51000000,124.66080000,'2026-04-15','Ipil','pending',0,'Kim Garcia'),
  ('TRE-1507','Zone III',12.51010000,124.66090000,'2025-02-10','Narra','verified',1,'Jay Pascual'),
  ('TRE-1508','Zone III',12.51060000,124.66100000,'2025-09-22','Molave','pending',0,'Rina Garcia')
ON DUPLICATE KEY UPDATE zone_name=VALUES(zone_name),latitude=VALUES(latitude),longitude=VALUES(longitude),planted_date=VALUES(planted_date),plant_species=VALUES(plant_species),plant_status=VALUES(plant_status),verification_count=VALUES(verification_count),location_address=VALUES(location_address);
