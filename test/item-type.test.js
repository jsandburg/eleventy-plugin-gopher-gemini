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
  assert.equal(gopherItemType("/files/song.mp3"), "9");
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
