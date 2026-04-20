export const authenticatorModel = {
  async create() {
    throw new Error("Authenticator storage is not configured in the Drizzle schema.");
  },

  async findUnique() {
    return null;
  },

  async findMany() {
    return [];
  },

  async update() {
    throw new Error("Authenticator storage is not configured in the Drizzle schema.");
  },
};
