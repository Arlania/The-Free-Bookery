import assert from "node:assert/strict";
import test from "node:test";

import {
  categoriesAreValid,
  doiIsValid,
  isbnIsValid,
  normalizeDoi,
  normalizeIsbn,
  normalizeRightsBasis,
  websiteIsValid,
} from "../src/book-metadata.js";
import { signatureIsValid } from "../src/book-files.js";

test("normalizes and validates ISBN-10 and ISBN-13", () => {
  assert.equal(normalizeIsbn("ISBN-13: 978-0-14-143951-8"), "9780141439518");
  assert.equal(isbnIsValid("978-0-14-143951-8"), true);
  assert.equal(isbnIsValid("0-306-40615-2"), true);
  assert.equal(isbnIsValid("978-0-14-143951-7"), false);
  assert.equal(isbnIsValid("not-an-isbn"), false);
  assert.equal(isbnIsValid(""), true);
});

test("normalizes and validates DOI values", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/ABC-123"), "10.1000/abc-123");
  assert.equal(doiIsValid("doi:10.1000/xyz"), true);
  assert.equal(doiIsValid("11.1000/not-a-doi"), false);
  assert.equal(doiIsValid(""), true);
});

test("enforces rights, genres, and website metadata", () => {
  assert.equal(normalizeRightsBasis("owned_or_administered"), "owned_or_administered");
  assert.equal(normalizeRightsBasis("public_domain"), "public_domain");
  assert.equal(normalizeRightsBasis("copyright"), "");
  assert.equal(categoriesAreValid("Fiction"), true);
  assert.equal(categoriesAreValid("Fiction, History, Poetry"), true);
  assert.equal(categoriesAreValid("One, Two, Three, Four"), false);
  assert.equal(websiteIsValid("https://example.com/author"), true);
  assert.equal(websiteIsValid("javascript:alert(1)"), false);
});

function epubPrefix(mimetype = "application/epub+zip", filename = "mimetype", compression = 0) {
  const encoder = new TextEncoder();
  const name = encoder.encode(filename);
  const content = encoder.encode(mimetype);
  const bytes = new Uint8Array(30 + name.length + content.length);
  const view = new DataView(bytes.buffer);
  bytes.set([0x50, 0x4b, 0x03, 0x04], 0);
  view.setUint16(8, compression, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  bytes.set(name, 30);
  bytes.set(content, 30 + name.length);
  return bytes;
}

test("accepts EPUB containers and rejects generic ZIP files", () => {
  assert.equal(signatureIsValid(epubPrefix(), "application/epub+zip"), true);
  assert.equal(signatureIsValid(epubPrefix("text/plain"), "application/epub+zip"), false);
  assert.equal(signatureIsValid(epubPrefix("application/epub+zip", "book.txt"), "application/epub+zip"), false);
  assert.equal(signatureIsValid(epubPrefix("application/epub+zip", "mimetype", 8), "application/epub+zip"), false);
});

test("recognizes supported PDF and image signatures", () => {
  assert.equal(signatureIsValid(new TextEncoder().encode("%PDF-1.7"), "application/pdf"), true);
  assert.equal(signatureIsValid(new TextEncoder().encode("not pdf"), "application/pdf"), false);
  assert.equal(signatureIsValid(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
  assert.equal(signatureIsValid(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
});
