-- Runs once, when the Postgres volume is first created (docker-entrypoint-initdb.d).
-- The throwaway database for the PgContentStore tests (npm run test:db);
-- the app database `imprint` is created by POSTGRES_DB in docker-compose.yml.
CREATE DATABASE imprint_test;
