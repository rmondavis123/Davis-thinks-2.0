// Lightweight localStorage-backed replacement for the Claude.ai artifact
// sandbox's `window.storage` API, so the rest of the app's storage calls
// work unchanged in a normal browser deployment. Data is stored only in
// the visiting browser, per-device, same as the original "personal" scope.

const storage = {
  async get(key) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return null;
      return { key, value };
    } catch (e) {
      return null;
    }
  },

  async set(key, value) {
    try {
      localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },

  async delete(key) {
    try {
      localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },
};

export default storage;
