import { describe, test, expect } from "vitest";
import { coinSchema } from "../../src/lib/schemas.js";

describe("coinSchema", () => {
  describe("valid input", () => {
    test("should accept a plain coin symbol", () => {
      // #given / #when
      const result = coinSchema.safeParse("BTC");

      // #then
      expect(result.success).toBe(true);
      expect(result.data).toBe("BTC");
    });

    test("should trim leading whitespace from coin input", () => {
      // #given / #when
      const result = coinSchema.safeParse("  BTC");

      // #then
      expect(result.success).toBe(true);
      expect(result.data).toBe("BTC");
    });

    test("should trim trailing whitespace from coin input", () => {
      // #given / #when
      const result = coinSchema.safeParse("ETH  ");

      // #then
      expect(result.success).toBe(true);
      expect(result.data).toBe("ETH");
    });

    test("should trim surrounding whitespace from coin input", () => {
      // #given / #when
      const result = coinSchema.safeParse("  SOL  ");

      // #then
      expect(result.success).toBe(true);
      expect(result.data).toBe("SOL");
    });
  });

  describe("invalid input", () => {
    test("should reject an empty string", () => {
      // #given / #when
      const result = coinSchema.safeParse("");

      // #then
      expect(result.success).toBe(false);
    });

    test("should reject a whitespace-only string", () => {
      // #given / #when
      const result = coinSchema.safeParse("   ");

      // #then
      expect(result.success).toBe(false);
    });
  });
});
