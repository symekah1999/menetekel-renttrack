import { describe, it, expect } from "vitest";
import { normalizePhone, darajaTimestamp, safeEqual, interpretStkQuery } from "@/lib/server/daraja";
import { parseCallback, formatDarajaDate } from "@/lib/server/stkCallback";

describe("normalizePhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["+254 712 345 678", "254712345678"],
    ["254712345678", "254712345678"],
    ["712345678", "254712345678"],
    ["0112345678", "254112345678"],
  ])("accepts %s", (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(["", "12345", "0612345678", "07123456789", "abc"])("rejects %s", (input) =>
    expect(normalizePhone(input)).toBeNull()
  );
});

describe("darajaTimestamp", () => {
  it("uses Nairobi time in YYYYMMDDHHmmss form", () => {
    expect(darajaTimestamp(new Date("2026-10-05T21:30:15Z"))).toBe("20261006003015");
  });
});

describe("safeEqual", () => {
  it("matches only identical strings", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secreT", "secret")).toBe(false);
    expect(safeEqual("short", "longer-secret")).toBe(false);
    expect(safeEqual(null, "secret")).toBe(false);
    expect(safeEqual(undefined, "secret")).toBe(false);
  });
});

describe("interpretStkQuery", () => {
  it("reads success, failure and still-waiting", () => {
    expect(interpretStkQuery({ ResultCode: "0" }).outcome).toBe("paid");
    expect(interpretStkQuery({ ResultCode: 0 }).outcome).toBe("paid");
    expect(interpretStkQuery({ ResultCode: "1032", ResultDesc: "Request cancelled by user" })).toEqual({
      outcome: "failed", description: "Request cancelled by user",
    });
    expect(interpretStkQuery({ errorCode: "500.001.1001", errorMessage: "being processed" }).outcome).toBe("pending");
  });
});

describe("parseCallback", () => {
  const success = {
    Body: { stkCallback: {
      CheckoutRequestID: "ws_CO_123", ResultCode: 0, ResultDesc: "The service request is processed successfully.",
      CallbackMetadata: { Item: [
        { Name: "Amount", Value: 4800 },
        { Name: "MpesaReceiptNumber", Value: "SJK1ABC234" },
        { Name: "TransactionDate", Value: 20261005143012 },
        { Name: "PhoneNumber", Value: 254712345678 },
      ] },
    } },
  };

  it("extracts amount, receipt and date from a successful payment", () => {
    expect(parseCallback(success)).toMatchObject({
      checkoutId: "ws_CO_123", success: true, amount: 4800, receipt: "SJK1ABC234", paidOn: "05/10/2026",
    });
  });

  it("reports a cancelled prompt as a failure with Safaricom's reason", () => {
    const r = parseCallback({ Body: { stkCallback: { CheckoutRequestID: "x", ResultCode: 1032, ResultDesc: "Request cancelled by user" } } });
    expect(r).toEqual({ checkoutId: "x", success: false, resultDesc: "Request cancelled by user" });
  });

  it("ignores bodies that aren't STK callbacks", () => {
    expect(parseCallback({})).toBeNull();
    expect(parseCallback(null)).toBeNull();
    expect(parseCallback({ Body: { stkCallback: {} } })).toBeNull();
  });

  it("formats Daraja dates and rejects malformed ones", () => {
    expect(formatDarajaDate("20261231235959")).toBe("31/12/2026");
    expect(formatDarajaDate("2026")).toBeUndefined();
  });
});
