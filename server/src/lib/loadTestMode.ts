/**
 * Opt-in flag that relaxes per-IP rate limits so k6 load tests (which send all
 * traffic from a single IP) don't get shut out by abuse-protection limiters
 * meant for real, distributed traffic. NEVER enable in production.
 */
export const LOAD_TEST_MODE = process.env["LOAD_TEST_MODE"] === "true";
