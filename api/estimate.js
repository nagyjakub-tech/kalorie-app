// Vercel serverless function: POST { image: base64Jpeg, mimeType } -> calorie estimate.
// GEMINI_API_KEY is read from the environment (set it in the Vercel project
// dashboard under Settings -> Environment Variables). It is never sent to the client.

const GEMINI_MODEL = 'gemini-3.6-flash';

const PROMPT = `Si výživový expert. Na fotke je jedlo alebo nápoj.
Identifikuj, čo je na fotke, odhadni veľkosť porcie podľa toho, čo je na fotke vidieť
(napr. veľkosť taniera, obalu, pohára) a odhadni nutričné hodnoty pre CELÚ porciu na fotke.
Ak je na fotke viac jedál naraz, súčet zahrň do celkových hodnôt a v "name" ich vymenuj.
Ak fotka neobsahuje jedlo ani nápoj, vráť name "Nerozpoznané jedlo" a calories 0 a do note napíš prečo.
Odpovedz IBA JSON objektom v tomto tvare, žiadny iný text:
{
  "name": "krátky názov jedla/nápoja v slovenčine",
  "calories": číslo (kcal, celá porcia),
  "protein_g": číslo,
  "carbs_g": číslo,
  "fat_g": číslo,
  "note": "krátka poznámka o odhade alebo neistote, v slovenčine, max 1 veta"
}`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server nemá nastavený GEMINI_API_KEY.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { image, mimeType } = body || {};
  if (!image) {
    res.status(400).json({ error: 'Chýba obrázok.' });
    return;
  }

  const payload = {
    contents: [{
      parts: [
        { text: PROMPT },
        { inline_data: { mime_type: mimeType || 'image/jpeg', data: image } },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => '');
      res.status(502).json({ error: `Gemini API error ${geminiRes.status}: ${errText.slice(0, 300)}` });
      return;
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      res.status(502).json({ error: 'Prázdna odpoveď z AI.' });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }
    if (!parsed) {
      res.status(502).json({ error: 'Nepodarilo sa spracovať odpoveď z AI.' });
      return;
    }

    res.status(200).json({
      name: String(parsed.name || 'Jedlo'),
      calories: Number(parsed.calories) || 0,
      protein_g: Number(parsed.protein_g) || 0,
      carbs_g: Number(parsed.carbs_g) || 0,
      fat_g: Number(parsed.fat_g) || 0,
      note: parsed.note ? String(parsed.note) : '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Chyba servera: ' + (err && err.message ? err.message : String(err)) });
  }
};
