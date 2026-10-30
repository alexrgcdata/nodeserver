// Only ParamsError messages are safe to return to a caller.
export class ParamsError extends Error {}

function noParams(params) {
  if (params.length !== 0) throw new ParamsError('this action expects an empty params array');
}

export function hello(params) {
  noParams(params);
  return 'hello world';
}

export function success(params) {
  noParams(params);
  return 'successful';
}

export function boolean(params) {
  noParams(params);
  return true;
}

// JSON arrays can contain mixed numbers, strings, objects, arrays, booleans and null.
export function echo(params) {
  return params;
}
