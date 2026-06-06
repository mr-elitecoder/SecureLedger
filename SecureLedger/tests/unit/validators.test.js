const {
  validateEmail,
  validatePassword,
} = require("../../src/validators/userValidator");

describe("User Validators", () => {
  describe("validateEmail", () => {
    test("should validate correct email formats", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("test.user@domain.co.uk")).toBe(true);
    });

    test("should reject invalid email formats", () => {
      expect(validateEmail("invalid.email")).toBe(false);
      expect(validateEmail("user@")).toBe(false);
    });
  });

  describe("validatePassword", () => {
    test("should validate strong passwords", () => {
      expect(validatePassword("SecurePass123!")).toBe(true);
    });

    test("should reject weak passwords", () => {
      expect(validatePassword("weak")).toBe(false);
      expect(validatePassword("noupppercase123!")).toBe(false);
    });
  });
});
