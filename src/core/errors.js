// dsh-usage-dashboard — unified project error taxonomy.
// Pure static module: no ctx/IO/DOM dependency.
export class BusinessException extends Error {
  /**
   * @param {string}  code    — stable error code (snake_cased, e.g. 'query_invalid_range')
   * @param {string}  message — human-readable description; defaults to empty string when omitted
   */
  constructor(code, message) {
    super(message ?? '')
    this.code = code ?? 'business_error'
    this.name = this.constructor.name
  }
}
