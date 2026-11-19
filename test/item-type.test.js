import { test } from "node:test";
import assert from "node:assert/strict";
import { gopherItemType } from "../lib/item-type.js";

test("maps trailing-slash paths to directory type 1", () => {
  assert.equal(gopherItemType("/blog/hello/"), "1");
});

test("maps image extensions to their Gopher item-type codes", () => {
  assert.equal(gopherItemType("/img/keroppi.gif"), "g");
  assert.equal(gopherItemType("/img/photo.jpg"), "I");
  assert.equal(gopherItemType("/img/photo.PNG"), "I");
});

test("maps other known binary extensions to type 9", () => {
  assert.equal(gopherItemType("/files/archive.zip"), "9");
  assert.equal(gopherItemType("/files/clip.mp4"), "9");
});

test("maps audio to sound type s and SVG to image type I", () => {
  assert.equal(gopherItemType("/files/song.mp3"), "s");
  assert.equal(gopherItemType("/files/take.WAV"), "s");
  assert.equal(gopherItemType("/img/logo.svg"), "I");
});

test("treats any non-Gopher URL as a type-h link, not a local selector", () => {
  assert.equal(gopherItemType("mailto:me@example.com"), "h");
  assert.equal(gopherItemType("gemini://example.org/"), "h");
  assert.equal(gopherItemType("ftp://example.org/file.zip"), "h");
});

test("reads the root menu type from a gopher:// URL with a bare trailing slash or IPv6 host", () => {
  assert.equal(gopherItemType("gopher://example.org/"), "1");
  assert.equal(gopherItemType("gopher://[::1]:70/0/notes.txt"), "0");
});

test("defaults to text type 0 for unknown or missing extensions", () => {
  assert.equal(gopherItemType("/about"), "0");
  assert.equal(gopherItemType("/notes.txt"), "0");
});

test("strips query strings and fragments before checking the extension", () => {
  assert.equal(gopherItemType("/img/photo.jpg?w=100#frag"), "I");
});

test("treats a dotfile's leading dot as having no extension", () => {
  assert.equal(gopherItemType(".gitignore"), "0");
});

test("uses the last extension of a multi-dot filename", () => {
  assert.equal(gopherItemType("archive.tar.gz"), "9");
});

test("maps web URLs to the h web-link type", () => {
  assert.equal(gopherItemType("https://example.com/"), "h");
  assert.equal(gopherItemType("http://example.com/page.html"), "h");
  assert.equal(gopherItemType("URL:https://example.com/"), "h");
});

test("takes the item type from a gopher:// URL's path", () => {
  assert.equal(gopherItemType("gopher://other.host/0/notes.txt"), "0");
  assert.equal(gopherItemType("gopher://other.host/9/file"), "9");
  assert.equal(gopherItemType("gopher://other.host/"), "1");
  assert.equal(gopherItemType("gopher://other.host"), "1");
});
