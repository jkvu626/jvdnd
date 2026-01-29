# Generative Maps (AI)

## Overview

Integrate AI-powered map generation to create custom battle maps from text prompts.

---

## Research Summary

| Tool | API | Cost/Image | Recommendation |
|------|-----|------------|----------------|
| DALL-E 3 | ✓ OpenAI API | $0.04-0.08 | **Best balance** |
| Stability AI | ✓ Official API | $0.01-0.02 | Budget option |
| Midjourney | ✗ No API | N/A | Not suitable |
| Leonardo.ai | ✓ Available | Variable | Backup option |

---

## Implementation: DALL-E 3

### Server Endpoint

#### [MODIFY] [server.js](file:///c:/Users/Jesse/Organize/Personal/jvdnd/server.js)

```javascript
const OpenAI = require('openai');
const openai = new OpenAI();

const MAP_PROMPT = `Create a top-down battle map for tabletop RPG. 
Bird's eye view, fantasy style, no text or grid.`;

app.post('/api/generate-map', async (req, res) => {
    const { prompt, size = '1024x1024' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    
    try {
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: `${MAP_PROMPT}\n\n${prompt}`,
            n: 1,
            size,
            quality: 'standard',
            response_format: 'url'
        });
        
        // Download, convert to WebP, save to library
        const imageUrl = response.data[0].url;
        const buffer = await (await fetch(imageUrl)).arrayBuffer();
        
        const id = crypto.randomBytes(8).toString('hex');
        await sharp(Buffer.from(buffer))
            .webp({ quality: 85 })
            .toFile(path.join(MAPS_DIR, `${id}.webp`));
        
        // Add to maps.json (same as upload flow)
        // ... save metadata ...
        
        res.json({ success: true, mapId: id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
```

### Client UI

Add to Map Library modal:
- Prompt textarea
- Size dropdown (1024x1024, 1792x1024, 1024x1792)
- Generate button with cost estimate (~$0.04)
- Loading indicator

### Environment

```bash
# .env
OPENAI_API_KEY=sk-xxx

# package.json
npm install openai
```

---

## Verification

1. Add OPENAI_API_KEY to `.env`
2. Restart server
3. Open Map Library → Generate section
4. Enter: "forest clearing with ancient ruins"
5. Verify map appears in library after ~15s

---

## Cost Analysis

$10/month budget = ~250 standard maps or ~125 HD maps

---

## Nano Banana Research

The user mentioned "Nano Banana" - needs investigation:
- [ ] Search for official documentation
- [ ] Determine if it's a real product or code name
- [ ] Evaluate API availability and pricing
