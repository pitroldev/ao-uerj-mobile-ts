type Schema = Readonly<Record<string, unknown>>;

/** Palavras-chave que `validate` confere; outra no esquema vira erro. */
const KEYWORDS = new Set([
  '$schema',
  'title',
  'description',
  'type',
  'required',
  'properties',
  'const',
  'enum',
  'pattern',
  'minLength',
  'maxLength',
  'format',
  'items',
  'maxItems',
  'uniqueItems',
]);

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function typeOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  return value === null ? 'null' : typeof value;
}

/**
 * Validador mínimo de JSON Schema, só com as palavras-chave que
 * config/app-status.schema.json usa (sem dependência nova). Devolve os erros;
 * uma palavra-chave desconhecida também é erro, para o teste crescer junto
 * com o esquema.
 */
export function validate(
  schema: Schema,
  value: unknown,
  path = 'documento',
): string[] {
  const errors = Object.keys(schema)
    .filter(keyword => !KEYWORDS.has(keyword))
    .map(keyword => `${path}: "${keyword}" não é conferida pelo teste`);
  const check = (ok: boolean, message: string) => {
    if (!ok) errors.push(`${path}: ${message}`);
  };
  if (schema.type !== undefined)
    check(
      typeOf(value) === schema.type,
      `não é ${JSON.stringify(schema.type)}`,
    );
  if ('const' in schema) check(value === schema.const, 'difere de const');
  if (Array.isArray(schema.enum))
    check(schema.enum.includes(value), 'fora do enum');
  if (typeof value === 'string') {
    if (typeof schema.pattern === 'string')
      check(
        new RegExp(schema.pattern, 'u').test(value),
        `não casa com ${schema.pattern}`,
      );
    if (typeof schema.minLength === 'number')
      check(value.length >= schema.minLength, 'curto demais');
    if (typeof schema.maxLength === 'number')
      check(value.length <= schema.maxLength, 'longo demais');
    if (schema.format === 'date-time')
      check(!Number.isNaN(Date.parse(value)), 'data inválida');
  }
  if (Array.isArray(value)) {
    const { items } = schema;
    if (typeof schema.maxItems === 'number')
      check(value.length <= schema.maxItems, 'itens demais');
    if (schema.uniqueItems === true)
      check(new Set(value).size === value.length, 'itens repetidos');
    if (isSchema(items))
      value.forEach((item, i) =>
        errors.push(...validate(items, item, `${path}[${i}]`)),
      );
  }
  if (isSchema(value)) {
    const { required, properties } = schema;
    if (Array.isArray(required))
      for (const key of required)
        check(typeof key === 'string' && key in value, `falta ${String(key)}`);
    if (isSchema(properties))
      for (const [key, property] of Object.entries(properties))
        if (key in value && isSchema(property))
          errors.push(...validate(property, value[key], `${path}.${key}`));
  }
  return errors;
}
