-- Optional operational labels make attire and rule guides findable on the
-- shared Barista workstation without requiring a title for every upload.

ALTER TABLE barista_sop_guides
  ADD COLUMN guide_title VARCHAR(120) NULL AFTER menu_item_id;
