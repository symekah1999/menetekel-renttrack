import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

/** Every block inside the phone-follows-dark-mode media query. */
function darkMediaBlocks(): string[] {
  const out: string[] = [];
  const re = /@media \(prefers-color-scheme: dark\)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    while (depth > 0 && i < css.length) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      i++;
    }
    out.push(css.slice(re.lastIndex, i - 1));
  }
  return out;
}

describe("manual Light/Dark theme", () => {
  it("only applies the phone's dark mode when the user has not forced Light", () => {
    for (const block of darkMediaBlocks()) {
      const selectors = block.split("{").slice(0, -1).map((chunk) => chunk.split("}").pop()!.trim());
      for (const sel of selectors) {
        for (const part of sel.split(",\n")) {
          expect(part.trim().startsWith(':root:not([data-theme="light"])')).toBe(true);
        }
      }
    }
  });

  it("has a forced-dark twin for every phone-dark rule", () => {
    const blocks = darkMediaBlocks().length;
    expect(blocks).toBeGreaterThanOrEqual(9);
    const forced = css.match(/:root\[data-theme="dark"\]/g) ?? [];
    expect(forced.length).toBeGreaterThanOrEqual(blocks);
  });

  it("still defines both palettes", () => {
    expect(css).toContain("--paper: #f4f2f9");
    expect(css).toContain("--paper: #14112a");
  });
});
