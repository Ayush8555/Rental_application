// Test environment. Values here are throwaway and only used against the
// local test database.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://rentnook:localdev@localhost:5432/rentnook_test';
process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL ??= 'redis://localhost:6379/5';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-test-access-secret-test-access';
process.env.REFRESH_TOKEN_PEPPER = 'test-pepper-test-pepper-test-pepper-test-pepper';
process.env.ADMIN_SESSION_SECRET = 'test-admin-session-test-admin-session-test-admin';
process.env.CSRF_SECRET = 'test-csrf-secret-test-csrf-secret-test-csrf-secret';
process.env.TOTP_ENC_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.URL_SIGNING_SECRET = 'test-url-signing-test-url-signing-test-url-sign';
process.env.ADMIN_ORIGIN = 'http://admin.test';
process.env.APP_BASE_URL = 'http://api.test';
process.env.PUBLIC_WEB_URL = 'http://www.test';
process.env.AUTH_PROVIDER = 'dev';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = `/tmp/rentnook-test-storage-${process.pid}`;
process.env.PUSH_PROVIDER = 'log';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_GLOBAL_PER_MIN = '100000';
