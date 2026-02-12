import Groq from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export interface ExtractedCallDetails {
  callDate: string | null;
  prospectName: string | null;
  callType: string | null;
  result: string | null;
  offerName: string | null;
  cashCollected: number | null;
  revenueGenerated: number | null;
  paymentType: string | null;
  numberOfInstalments: number | null;
  monthlyAmount: number | null;
  reasonForResult: string | null;
}

const EMPTY_RESULT: ExtractedCallDetails = {
  callDate: null,
  prospectName: null,
  callType: null,
  result: null,
  offerName: null,
  cashCollected: null,
  revenueGenerated: null,
  paymentType: null,
  numberOfInstalments: null,
  monthlyAmount: null,
  reasonForResult: null,
};

export async function extractCallDetails(
  transcript: string,
  offerNames: string[]
): Promise<ExtractedCallDetails> {
  if (!groq) {
    console.warn('[extract-call-details] No Groq API key — skipping extraction');
    return EMPTY_RESULT;
  }

  const snippet = transcript.slice(0, 4000);
  const offerList = offerNames.length > 0 ? offerNames.join(', ') : 'None provided';

  const prompt = `You are a sales call analyst. Extract factual details from this transcript.
Return ONLY a JSON object — no markdown, no explanation.

Rules:
- prospectName: The person being sold to (not the sales rep/closer)
- callType: 'closing' if this is a first sales conversation, 'follow_up' if they reference a previous conversation or say 'follow up', 'roleplay' if it's clearly a practice/training session
- result: 'closed' if a deal/sale was agreed, 'deposit' if a partial payment or deposit was taken, 'lost' if prospect said no or declined, 'follow_up_result' if call ended with a scheduled callback, 'unqualified' if prospect wasn't a fit or wasn't decision-maker
- Only fill financial fields if EXPLICITLY stated amounts
- For any field you cannot confidently determine, use null

Available offers to match against: ${offerList}

Expected JSON shape:
{
  "callDate": null,
  "prospectName": null,
  "callType": null,
  "result": null,
  "offerName": null,
  "cashCollected": null,
  "revenueGenerated": null,
  "paymentType": null,
  "numberOfInstalments": null,
  "monthlyAmount": null,
  "reasonForResult": null
}

Transcript (first 4000 chars):
---
${snippet}
---`;

  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return EMPTY_RESULT;

    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Map callType values to DB enum values
    let callType = typeof parsed.callType === 'string' ? parsed.callType : null;
    if (callType === 'closing') callType = 'closing_call';

    // Validate result values
    const validResults = ['closed', 'deposit', 'lost', 'follow_up_result', 'unqualified'];
    let result = typeof parsed.result === 'string' ? parsed.result : null;
    if (result && !validResults.includes(result)) result = null;

    // Validate paymentType
    const validPaymentTypes = ['paid_in_full', 'payment_plan'];
    let paymentType = typeof parsed.paymentType === 'string' ? parsed.paymentType : null;
    if (paymentType && !validPaymentTypes.includes(paymentType)) paymentType = null;

    return {
      callDate: typeof parsed.callDate === 'string' ? parsed.callDate : null,
      prospectName: typeof parsed.prospectName === 'string' ? parsed.prospectName : null,
      callType,
      result,
      offerName: typeof parsed.offerName === 'string' ? parsed.offerName : null,
      cashCollected: typeof parsed.cashCollected === 'number' ? parsed.cashCollected : null,
      revenueGenerated: typeof parsed.revenueGenerated === 'number' ? parsed.revenueGenerated : null,
      paymentType,
      numberOfInstalments: typeof parsed.numberOfInstalments === 'number' ? parsed.numberOfInstalments : null,
      monthlyAmount: typeof parsed.monthlyAmount === 'number' ? parsed.monthlyAmount : null,
      reasonForResult: typeof parsed.reasonForResult === 'string' ? parsed.reasonForResult : null,
    };
  } catch (err) {
    console.error('[extract-call-details] Extraction failed:', err);
    return EMPTY_RESULT;
  }
}
