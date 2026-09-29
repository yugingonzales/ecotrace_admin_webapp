-- Migration 006 — backfill the new tree_* attributes for the seeded trees.
--
-- tree_planter_name: the 23-row dev seed parked each planter's name inside
-- location_address because the pre-rename table had no planter column (that
-- hack is called out in the 003 header and in INTEGRATION_PROGRESS_LOG.md).
-- Migration 004 added the real column, so this moves the names in and clears
-- the fake address. The guard treats location_address as a name only when it
-- holds no digit and no comma, so a genuine street address is never consumed
-- or cleared by accident.
--
-- tree_description: one short free-form note per seeded tree, keyed on the
-- UNIQUE tree_code so this is safe to re-run.

UPDATE ecotrace_plants
SET tree_planter_name = location_address,
    location_address = NULL
WHERE tree_planter_name IS NULL
  AND location_address IS NOT NULL
  AND location_address NOT REGEXP '[0-9,]';

UPDATE ecotrace_plants
SET tree_description = CASE tree_code
  WHEN 'TRE-0892' THEN 'Tall Narra at the Zone I gate entrance, full healthy canopy'
  WHEN 'TRE-0567' THEN 'Molave by the pathway bend, under observation for an incident report'
  WHEN 'TRE-1204' THEN 'Young Ipil behind the flagpole lawn, awaiting verification'
  WHEN 'TRE-0341' THEN 'Mahogany shade tree beside the covered walk, verified healthy'
  WHEN 'TRE-1108' THEN 'Squat Kamagong near the basketball court, pending verification'
  WHEN 'TRE-0223' THEN 'Second Narra along the walkway, well established and healthy'
  WHEN 'TRE-0412' THEN 'Ipil at the east lawn corner, verified healthy'
  WHEN 'TRE-1501' THEN 'First-planted Narra on campus, fully matured and verified'
  WHEN 'TRE-1502' THEN 'Molave across the parking lot, pending verification'
  WHEN 'TRE-1503' THEN 'Kamagong specimen near the old quad, verified healthy'
  WHEN 'TRE-0783' THEN 'Banaba at the riverbank side, incident flagged with crown thinning'
  WHEN 'TRE-0950' THEN 'Molave in the seedling block, incident report under review'
  WHEN 'TRE-1056' THEN 'Narra beside the field office, currently unverified'
  WHEN 'TRE-0834' THEN 'Narra along the Zone II trail, awaiting verification'
  WHEN 'TRE-1504' THEN 'Ipil near the floodlight post, verified healthy'
  WHEN 'TRE-1505' THEN 'Banaba close to the perimeter fence, incident flagged'
  WHEN 'TRE-1506' THEN 'Mahogany planted at the back row, verified healthy'
  WHEN 'TRE-0678' THEN 'Mahogany at the slope edge, currently unverified'
  WHEN 'TRE-0199' THEN 'Banaba beside the drainage line, verified healthy'
  WHEN 'TRE-0455' THEN 'Kamagong on the slope terrace, verified healthy'
  WHEN 'TRE-1320' THEN 'Ipil at the far plot corner, pending verification'
  WHEN 'TRE-1507' THEN 'Narra on the upper terrace, verified healthy'
  WHEN 'TRE-1508' THEN 'Molave near the zone sign, pending verification'
END
WHERE tree_code IN (
  'TRE-0892','TRE-0567','TRE-1204','TRE-0341','TRE-1108','TRE-0223','TRE-0412',
  'TRE-1501','TRE-1502','TRE-1503','TRE-0783','TRE-0950','TRE-1056','TRE-0834',
  'TRE-1504','TRE-1505','TRE-1506','TRE-0678','TRE-0199','TRE-0455','TRE-1320',
  'TRE-1507','TRE-1508'
);