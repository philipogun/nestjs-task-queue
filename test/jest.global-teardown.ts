module.exports = async () => {
    // Clean up any resources
    if (global.__TEST_CONTAINERS__?.redis) {
      await global.__TEST_CONTAINERS__.redis.quit();
    }
  };