import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

export async function complete(systemPrompt, userPrompt, maxTokens = 1000) {
  const msg = await groq.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt  },
    ],
  })
  return msg.choices[0].message.content
}
