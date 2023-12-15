/*
 * This file adapted from module "colorette", originally found here:
 * https://github.com/jorgebucaran/colorette/blob/0928e67466a34e50b53c7a908f32e738c3904846/index.js
 *
 * Copyright © Jorge Bucaran <<https://jorgebucaran.com>>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the 'Software'), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import { isatty } from "tty";

const {
  env = {},
  argv = [],
  platform = "",
} = typeof process === "undefined" ? {} : process;

const isDisabled = "NO_COLOR" in env || argv.includes("--no-color");
const isForced = "FORCE_COLOR" in env || argv.includes("--color");
const isWindows = platform === "win32";
const isDumbTerminal = env["TERM"] === "dumb";

const isCompatibleTerminal = Boolean(
  isatty(1) && env["TERM"] && !isDumbTerminal,
);

const isCI =
  "CI" in env &&
  ("GITHUB_ACTIONS" in env || "GITLAB_CI" in env || "CIRCLECI" in env);

export const isColorSupported =
  !isDisabled &&
  (isForced || (isWindows && !isDumbTerminal) || isCompatibleTerminal || isCI);

const replaceClose = (
  index: number,
  str: string,
  close: string,
  replace: string,
  head = str.slice(0, index) + replace,
  tail = str.slice(index + close.length),
  next = tail.indexOf(close),
): string =>
  head + (next < 0 ? tail : replaceClose(next, tail, close, replace));

const clearBleed = (
  index: number,
  str: string,
  open: string,
  close: string,
  replace: string,
) =>
  index < 0
    ? open + str + close
    : open + replaceClose(index, str, close, replace) + close;

const filterEmpty =
  (open: string, close: string, replace = open, at = open.length + 1) =>
  (str: string) =>
    str || !(str === "" || str === undefined)
      ? clearBleed(String(str).indexOf(close, at), str, open, close, replace)
      : "";

const create = (open: number, close: number, replace?: string) =>
  isColorSupported
    ? filterEmpty(`\x1b[${open}m`, `\x1b[${close}m`, replace)
    : String;

export const red = create(31, 39);
export const green = create(32, 39);
export const yellow = create(33, 39);
export const blue = create(34, 39);
export const magenta = create(35, 39);
export const cyan = create(36, 39);
