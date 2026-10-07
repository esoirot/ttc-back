// Typed asymmetric matchers: `expect.any(...)` is typed `any`, which the lint
// rules reject inside object literals.
export const anyNumber = expect.any(Number) as number;
export const anyString = expect.any(String) as string;
export const anyDate = expect.any(Date) as Date;
export const isoTimestamp = expect.stringMatching(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
) as string;
