import { describe, expect, it } from "vitest";
import { CLAUSES, agreementFields } from "@/lib/agreement";
import { buildTenancyAgreement } from "@/lib/agreementPdf";
import { EMPTY_TENANT, cleanDetails } from "@/lib/tenants";

const text = (f: ReturnType<typeof agreementFields>) => {
  const doc = buildTenancyAgreement(f);
  return doc.output("datauristring") && (doc as unknown as { internal: { pages: string[][] } }).internal.pages.flat().join(" ");
};

describe("tenancy agreement", () => {
  it("keeps all twelve clauses and the six eviction grounds", () => {
    expect(CLAUSES.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(CLAUSES[11].sub).toHaveLength(6);
  });
  it("fills the tenant's details from the profile", () => {
    const d = cleanDetails({ ...EMPTY_TENANT, tenant: "  Jane  Wanjiru ", idNo: "12345678", workplace: "KRA, Times Tower", phone: "0712345678" });
    const f = agreementFields(2, "Unit 3", d);
    expect(f).toEqual({ name: "Jane Wanjiru", idNo: "12345678", workplace: "KRA, Times Tower", phone: "0712345678", room: "Unit 3, Floor 2" });
    const t = text(f);
    expect(t).toContain("Jane Wanjiru");
    expect(t).toContain("12345678");
    expect(t).toContain("Unit 3, Floor 2");
  });
  it("still builds when details are missing, leaving lines to fill by hand", () => {
    const doc = buildTenancyAgreement(agreementFields(1, "Unit 1", EMPTY_TENANT));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
  it("trims place of work like the other fields", () => {
    expect(cleanDetails({ ...EMPTY_TENANT, tenant: "A", workplace: "  Nairobi   Hospital " }).workplace).toBe("Nairobi Hospital");
  });
});
