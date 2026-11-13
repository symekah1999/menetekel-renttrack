import { describe, it, expect } from "vitest";
import { csvCell, toCsv } from "@/lib/reportExports";

describe("CSV export", () => {
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Wanjiru, Amina")).toBe('"Wanjiru, Amina"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });
  it("defuses text a spreadsheet would run as a formula, but leaves numbers alone", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+254712345678")).toBe("'+254712345678");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell(-4800)).toBe("-4800");
    expect(csvCell(null)).toBe("");
  });
  it("joins rows with Windows line endings for Excel", () => {
    expect(toCsv([["a", 1], ["b", 2]])).toBe("a,1\r\nb,2");
  });
});
