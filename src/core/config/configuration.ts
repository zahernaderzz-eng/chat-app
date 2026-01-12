export default () => ({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'access-secret-change-me',
  JWT_ACCESS_EXPIRES_IN: Number(
    process.env.JWT_ACCESS_EXPIRES_IN || 3600000000000000,
  ),

  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-me',
  JWT_REFRESH_EXPIRES_IN: Number(process.env.JWT_REFRESH_EXPIRES_IN || 604800),

  THROTTLE_TTL: Number(process.env.THROTTLE_TTL || 60) * 1000,
  THROTTLE_LIMIT: Number(process.env.THROTTLE_LIMIT || 10),
});
