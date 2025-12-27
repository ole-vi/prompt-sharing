const fetch = require("node-fetch");

/**
 * Jules Provider Service
 * Handles direct interactions with the Jules API.
 */
class JulesProvider {
  constructor() {
    this.baseUrl = "https://jules.googleapis.com/v1alpha";
  }

  async createSession(apiKey, body) {
    const r = await fetch(`${this.baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey
      },
      body: JSON.stringify(body)
    });

    let json;
    try {
      json = await r.json();
    } catch (e) {
      throw new Error(`Failed to parse Jules response: ${e.message}`);
    }

    if (!r.ok) {
      throw new Error(`Jules API error: ${r.status} - ${JSON.stringify(json)}`);
    }

    if (!json || !json.url) {
      throw new Error("Jules did not return a session URL");
    }

    return { sessionUrl: json.url };
  }

  async validateKey(apiKey) {
    const r = await fetch(`${this.baseUrl}/sessions`, {
      method: "GET",
      headers: { "X-Goog-Api-Key": apiKey }
    });
    return { ok: r.ok, status: r.status };
  }
}

module.exports = new JulesProvider();
