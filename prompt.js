// export function buildTranslationPrompt(chunkText, chunkNumber, totalChunks) {
//   return `You are a professional English to Hindi translator for YouTube videos. This is chunk ${chunkNumber} of ${totalChunks}.

// CRITICAL REQUIREMENTS FOR YOUTUBE & ELEVENLABS:

// 1. **CHARACTER NAME CONSISTENCY**:
//    - "Joanna" → "जोआना" (CORRECT SPELLING)
//    - "Sophie" → "सोफी"
//    - Keep all character names consistent

// 2. **SPOKEN HINDI RULES**:
//    - Use only everyday conversational Hindi
//    - Maximum 8-10 words per sentence
//    - Break long English sentences into multiple short Hindi sentences
//    - Use natural Hindi sentence structure (Subject-Object-Verb)

// 3. **PRONUNCIATION-FRIENDLY WORDS**:
//    - Avoid complex Sanskrit words
//    - Use common Hindi words that TTS can pronounce easily
//    - No tongue-twisters

// 4. **SIMPLE WORD REPLACEMENTS**:
//    - "philosophical" → "गहरी सोच वाला"
//    - "existence" → "मौजूदगी", "होना"
//    - "intensively" → "गहराई से", "अच्छी तरह"
//    - "living" → "ज़िंदा"
//    - "death" → "मौत"

// 5. **YOUTUBE AUDIENCE FOCUS**:
//    - Language should be easy for 12+ age group
//    - No literary or complex phrases
//    - Like natural daily conversation

// 6. **COMPLETE TRANSLATION**: Translate every sentence without skipping.

// 7. **EXPLANATIONS**: For difficult concepts, add: "यहां समझिए: [simple explanation in 1 line]"

// English Text to Translate:
// ${chunkText}

// Remember: This is for YouTube audience - keep it SIMPLE, NATURAL and EASY TO SPEAK. Start translating now:`;
// }

export function buildTranslationPrompt(chunkText, chunkNumber, totalChunks) {
  return `You are a professional Hindi translator for YouTube audiobooks. This is chunk ${chunkNumber} of ${totalChunks}.

CRITICAL YOUTUBE AUDIOBOOK RULES:

🎯 **CHARACTER NAME CONSISTENCY (MUST FOLLOW)**:
   - "Sophie Amundsen" → "सोफी अमुंडसेन"
   - "Joanna" → "जोआना" (ALWAYS THIS SPELLING)
   - "Sherkhan" → "शेरेखान"
   - Keep ALL names consistent throughout

🎤 **ELEVENLABS VOICEOVER FRIENDLY**:
   - Maximum 8-10 words per sentence
   - Use only common Hindi words that TTS can pronounce easily
   - Avoid tongue-twisters and complex consonant clusters
   - Natural pause between sentences

🗣️ **SPOKEN HINDI STYLE**:
   - Like storytelling to a friend
   - Use simple Subject-Object-Verb structure
   - Break long English sentences into 2-3 short Hindi sentences
   - No literary or bookish language

📝 **SIMPLE WORD GUIDE**:
   - "philosophical" → "गहरी सोच वाला"
   - "existence" → "मौजूदगी", "होना"
   - "intensively" → "गहराई से", "अच्छी तरह"
   - "living/alive" → "ज़िंदा"
   - "death" → "मौत"
   - "garden" → "बगीचा", "बाग़"
   - "mailbox" → "डाकपेटी", "मेलबॉक्स"

🎧 **YOUTUBE AUDIENCE**:
   - Language easy for 12-year-old to understand
   - Smooth flow for listening experience
   - Clear pronunciation for voiceover

🔍 **QUALITY CHECKS**:
   - Translate EVERY sentence completely
   - No grammatical errors
   - Natural Hindi sentence flow
   - Consistent character names

📚 **EXPLANATIONS**:
   For complex ideas, add: "यहां समझिए: [1-line simple explanation]"

English Text to Translate:
${chunkText}

Remember: This is for YouTube AUDIOBOOK - keep it SIMPLE, CLEAR and perfect for VOICEOVER. Start translating now:`;
}

// export function buildTranslationPrompt(chunkText, chunkNumber, totalChunks) {
//   return `You are a professional Hindi translator for YouTube audiobooks. This is chunk ${chunkNumber} of ${totalChunks}.

// 🎯 **CRITICAL REQUIREMENTS FOR YOUTUBE & ELEVENLABS:**

// **CHARACTER NAME CONSISTENCY (MUST FOLLOW)**:
// - "Sophie Amundsen" → "सोफी अमुंडसेन"
// - "Joanna" → "जोआना" (ALWAYS THIS SPELLING)
// - "Sherkhan" → "शेरेखान"
// - Keep ALL names consistent throughout

// **VOICEOVER OPTIMIZATION**:
// - Maximum 8-12 words per sentence (ELEVENLABS FRIENDLY)
// - Use only common Hindi words that TTS can pronounce easily
// - Avoid tongue-twisters and complex consonant clusters
// - Natural pause between sentences for better audio flow

// **SPOKEN HINDI STYLE**:
// - Like natural storytelling to a friend
// - Use simple Subject-Object-Verb structure
// - Break long English sentences into 2-3 short Hindi sentences
// - No literary or bookish language - only daily conversation

// **SIMPLE WORD GUIDE**:
// - "philosophical" → "गहरी सोच वाला", "विचारवादी"
// - "existence" → "मौजूदगी", "होना"
// - "intensively" → "गहराई से", "अच्छी तरह", "बारीकी से"
// - "living/alive" → "ज़िंदा"
// - "death" → "मौत"
// - "garden" → "बगीचा"
// - "mailbox" → "डाकपेटी"
// - "thoughts" → "सोच", "विचार"
// - "feeling" → "अहसास", "लगना"

// **YOUTUBE AUDIENCE FOCUS**:
// - Language should be easy for 12+ age group to understand
// - Smooth listening experience like audio storytelling
// - Clear pronunciation for voiceover

// **QUALITY CHECKS**:
// - Translate EVERY sentence completely without skipping
// - No grammatical errors
// - Natural Hindi sentence flow
// - Consistent character names throughout

// **EXPLANATIONS**:
// For complex philosophical ideas, add simple 1-line explanations:
// "यहां समझिए: [simple explanation in everyday Hindi]"

// English Text to Translate:
// ${chunkText}

// Remember: This is for YouTube AUDIOBOOK - keep it SIMPLE, CLEAR, NATURAL and perfect for VOICEOVER. Start translating now:`;
// }
