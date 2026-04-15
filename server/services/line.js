import axios from 'axios'

const LINE_API = 'https://api.line.me/v2/bot/message'

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function replyMessage(replyToken, text) {
  try {
    await axios.post(`${LINE_API}/reply`, {
      replyToken,
      messages: [{ type: 'text', text }],
    }, { headers: getHeaders() })
  } catch (err) {
    console.error('[line] replyMessage failed:', err.response?.data ?? err.message)
  }
}

export async function pushMessage(lineUserId, text) {
  try {
    await axios.post(`${LINE_API}/push`, {
      to: lineUserId,
      messages: [{ type: 'text', text }],
    }, { headers: getHeaders() })
  } catch (err) {
    console.error('[line] pushMessage failed:', err.response?.data ?? err.message)
  }
}
