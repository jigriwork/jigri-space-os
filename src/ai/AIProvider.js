export default class AIProvider {
  /**
   * Classify the user's thought into runtime mode.
   * @param {string} text
   * @returns {'negative'|'anger'|'confusion'|'positive'}
   */
  detectThoughtType(text) {
    throw new Error('Not implemented');
  }

  /**
   * Detect conversation mode for tone routing.
   * @param {string} text
   * @param {'negative'|'anger'|'confusion'|'positive'} thoughtType
   * @param {string} emotion
   * @returns {'venting'|'loneliness'|'casual'|'happiness'}
   */
  detectConversationMode(text, thoughtType = 'negative', emotion = 'stress') {
    throw new Error('Not implemented');
  }

  /**
   * Generate a short mode-aware response.
   * @param {string} userText
   * @param {'negative'|'anger'|'confusion'|'positive'} thoughtType
   * @returns {Promise<string>}
   */
  async defuse(userText, thoughtType = 'negative', options = {}) {
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
