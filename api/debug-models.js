// TEMPORARY diagnostic endpoint — lists available Gemini models for this API key.
// Will be deleted once we've picked a working model.
module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'No GEMINI_API_KEY' });
    return;
  }
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await r.json();
    const models = (data.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace('models/', ''));
    res.status(r.status).json({ status: r.status, models });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};
