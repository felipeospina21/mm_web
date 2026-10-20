/** Capitalize the first letter of each word without changing stored values. */
export function capitalizeName(value: string): string {
  return value.replace(/(^|[\s'-])(\p{L})/gu, (_match, boundary: string, letter: string) =>
    `${boundary}${letter.toLocaleUpperCase("es-CO")}`,
  );
}

/** Capitalize the name after a label such as "Customer: ". */
export function capitalizeLabeledName(value: string): string {
  const separator = value.indexOf(":");
  if (separator < 0) return capitalizeName(value);

  const label = value.slice(0, separator + 1);
  const rest = value.slice(separator + 1);
  const whitespace = rest.match(/^\s*/u)?.[0] ?? "";
  return `${label}${whitespace}${capitalizeName(rest.slice(whitespace.length))}`;
}
