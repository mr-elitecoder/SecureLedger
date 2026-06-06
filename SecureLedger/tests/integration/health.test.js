const request = require("supertest");
const app = require("../../src/app");

describe("Health Check", () => {
  test("GET /health should return 200", async () => {
    const response = await request(app).get("/health").expect(200);

    expect(response.body.status).toBe("OK");
  });
});
