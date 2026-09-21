// Forwarding to centralized redis utility
const redis = require('../src/utils/redis');

module.exports = {
  get: redis.get,
  set: redis.set,
  del: redis.del,
};
