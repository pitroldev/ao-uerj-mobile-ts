import { stringFor } from '../validation.ts';

/** Base64url com o `=` do fim, como a RFC 9577 pede. */
export const base64url = (bytes: Buffer) =>
  bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Um campo em base64url, com ou sem o `=`, de exatamente `length` bytes. */
export const bytesField = (field: string, length: number) =>
  stringFor(field)
    .regex(BASE64URL, `${field} must be base64url`)
    .transform(value => Buffer.from(value, 'base64url'))
    .refine(
      bytes => bytes.length === length,
      `${field} must have ${length} bytes`,
    );
