-- Reserved migration. Independent cafes use separate backend and database
-- deployments, so no cross-cafe platform role is created in a tenant database.
SELECT 1;
