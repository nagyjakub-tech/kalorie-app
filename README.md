# Kalorické tabuľky

PWA appka: odfotíš jedlo/nápoj, AI (Google Gemini) odhadne kalórie a makrá, appka si to
pamätá a vedie históriu + denný súhrn. Dá sa uložiť na plochu iPhone ako normálna appka.

## 1. Získaj zadarmo Gemini API kľúč

1. Otvor https://aistudio.google.com/apikey
2. Prihlás sa Google účtom.
3. Klikni **Create API key**.
4. Skopíruj vygenerovaný kľúč (bude niečo ako `AIza...`). **Nikomu ho neposielaj a nevkladaj do appky priamo** — appka ho používa iba cez server.

Free tier stačí na bežné osobné používanie (desiatky požiadaviek denne zadarmo).

## 2. Nahraj kód na GitHub

V priečinku `kalorie-app`:

```bash
git init
git add .
git commit -m "Kalorické tabuľky - initial commit"
```

Potom si vytvor nový (prázdny) repozitár na https://github.com/new a spusti príkazy,
ktoré GitHub ukáže po vytvorení (`git remote add origin ...`, `git push -u origin main`).

## 3. Nasaď na Vercel (zadarmo)

1. Otvor https://vercel.com/signup a prihlás sa (najjednoduchšie cez "Continue with GitHub").
2. Klikni **Add New... → Project**, vyber repozitár `kalorie-app`, ktorý si pushol na GitHub.
3. V kroku **Environment Variables** pred deployom pridaj:
   - Name: `GEMINI_API_KEY`
   - Value: (vlož svoj Gemini kľúč z kroku 1)
4. Klikni **Deploy**.
5. Po skončení dostaneš verejnú adresu typu `https://kalorie-app-xxxx.vercel.app`.

Ak neskôr zmeníš kľúč, dá sa upraviť v **Project → Settings → Environment Variables**
(a treba spraviť redeploy).

## 4. Ulož appku na plochu iPhone

1. Otvor tú `vercel.app` adresu v **Safari** na iPhone.
2. Klikni na tlačidlo **Zdieľať** (štvorček so šípkou).
3. Vyber **Pridať na plochu** (Add to Home Screen).
4. Appka sa objaví ako normálna ikonka a spúšťa sa na celú obrazovku, bez adresného riadku Safari.

## Ako appka funguje

- **📷 tlačidlo** dole odfotí/vyberie fotku jedla.
- Appka fotku zmenší a pošle na `/api/estimate` (serverless funkcia na Vercel), ktorá
  zavolá Gemini vision model a vráti odhad názvu, kalórií a makier.
- Výsledok si môžeš pred uložením opraviť (napr. ak appka odhadne veľkosť porcie inak).
- Všetky záznamy sa ukladajú v telefóne (`localStorage`), appka si pamätá históriu podľa dní,
  počíta denný súhrn oproti cieľu a graf posledných 7 dní.
- Cieľ kalórií nastavíš v ⚙️ Nastavenia.

## Lokálne testovanie (voliteľné)

Appka je čisto statická (HTML/CSS/JS) + jedna serverless funkcia, takže bez Vercel CLI
sa `/api/estimate` lokálne nespustí. Najjednoduchšie je testovať priamo na nasadenej
Vercel adrese. Ak chceš testovať lokálne, treba nainštalovať Node.js a Vercel CLI
(`npm i -g vercel`, potom `vercel dev` v tomto priečinku).
