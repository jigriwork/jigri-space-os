export default class AIProvider {
  /**
   * Defuse a raw thought into cognitive separation output.
   * @param {string} userText
   * @returns {Promise<string>}
   */
  async defuse(userText) {
    throw new Error('Not implemented');
  }

  /**
   * Detect dominant emotional profile for visual behavior.
   * @param {string} text
   * @returns {string}
   */
  detectEmotion(text) {
    throw new Error('Not implemented');
  }

  /**
   * Estimate intensity 0..1 for entity sizing/energy.
   * @param {string} text
   * @returns {number}
   */
  estimateIntensity(text) {
    throw new Error('Not implemented');
  }
}
