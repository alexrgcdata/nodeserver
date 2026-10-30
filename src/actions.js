import { hello, success, boolean, echo } from './functions.js';

// Complete action allow-list. Add implementations in functions.js, then register
// them here. A Map also prevents names such as "constructor" invoking anything.
export const actions = new Map([
  ['hello', hello],       // [] -> "hello world"
  ['success', success],   // [] -> "successful"
  ['boolean', boolean],   // [] -> true
  ['echo', echo],         // [any JSON values...] -> same array
]);
