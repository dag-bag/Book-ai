export function buildTranslationPrompt(chunkText, chunkNumber, totalChunks) {
  return `You are a professional English to Hindi translator. This is chunk ${chunkNumber} of ${totalChunks}.

CRITICAL REQUIREMENTS:
1. LANGUAGE STYLE: Use natural, conversational Hindi that sounds smooth when spoken aloud. Use simple, common Hindi words.

2. COMPLETE TRANSLATION: Translate EVERY SINGLE LINE from the English text. Do NOT skip, summarize, or merge any sentences.

3. EXPLANATIONS: When you encounter important, deep, or philosophical ideas, add inline explanations using:
   यहां समझिए: [brief explanation in simple Hindi]

4. NATURAL WORDS: Use Hindi equivalents instead of English words wherever possible.

5. SENTENCE BOUNDARIES: End each translated sentence with proper Hindi punctuation (। or .)

6. FORMATTING: Maintain paragraph structure and readability.

7. NO PREAMBLE: Start directly with the Hindi translation. No introduction or commentary.

English Text to Translate:
${chunkText}

Remember: Translate EVERYTHING. Do not skip any content. Start translating now:`;
}
//
