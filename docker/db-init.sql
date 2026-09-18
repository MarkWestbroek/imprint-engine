-- Runs once, when the MariaDB volume is first created (docker-entrypoint-initdb.d).
-- Throwaway databases: imprint_test for the store suites (npm run test:db),
-- imprint_e2e for the browser tests (npm run test:e2e). On an existing volume,
-- run these statements by hand (see .env.example).
CREATE DATABASE IF NOT EXISTS imprint_test;
CREATE DATABASE IF NOT EXISTS imprint_e2e;
GRANT ALL ON imprint_test.* TO 'imprint'@'%';
GRANT ALL ON imprint_e2e.* TO 'imprint'@'%';
