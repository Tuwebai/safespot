/**
 * IdentityInvariantViolation
 * 
 * Error lanzado cuando se viola una invariante de identidad crítica.
 * Este error indica que el sistema intentó operar con una identidad inválida
 * o inexistente en un contexto donde esto no es permitido.
 * 
 * REGLA: Este error NUNCA debe ser silenciado. Si ocurre, hay un bug
 * en el flujo que no ejecutó guardIdentityReady() antes de la operación.
 */
export class IdentityInvariantViolation extends Error {
  public readonly context: string;
  public readonly field: string;
  public readonly attemptedValue: unknown;

  constructor(
    message: string,
    context: string,
    field: string,
    attemptedValue?: unknown
  ) {
    super(message);
    this.name = 'IdentityInvariantViolation';
    this.context = context;
    this.field = field;
    this.attemptedValue = attemptedValue;

    // Mantener stack trace en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IdentityInvariantViolation);
    }
  }

  toString(): string {
    return `[${this.name}] ${this.message} | Context: ${this.context} | Field: ${this.field} | Value: ${this.attemptedValue ?? 'undefined'}`;
  }
}

/**
 * Asserts that a value is a valid non-empty string UUID.
 * Throws IdentityInvariantViolation if not.
 */
export function assertValidIdentity(
  value: unknown,
  fieldName: string,
  context: string
): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '' || value === 'unknown') {
    throw new IdentityInvariantViolation(
      `Invalid identity: ${fieldName} must be a valid UUID string`,
      context,
      fieldName,
      value
    );
  }

  // Validación básica de formato UUID v4
  const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!UUID_V4_REGEX.test(value)) {
    throw new IdentityInvariantViolation(
      `Invalid identity: ${fieldName} is not a valid UUID v4 format`,
      context,
      fieldName,
      value
    );
  }
}
