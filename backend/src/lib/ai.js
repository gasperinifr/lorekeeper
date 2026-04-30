import Groq from 'groq-sdk'

const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'
let groq

function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('Groq nao configurado: defina GROQ_API_KEY.')
  }

  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groq
}

export async function complete(systemPrompt, userPrompt, maxTokens = 1000) {
  const msg = await getGroq().chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })
  return msg.choices[0].message.content
}
