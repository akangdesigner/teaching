import axios from 'axios'

const LINE_API = 'https://api.line.me/v2/bot/message'

function getHeaders() {
  return {
    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export async function replyMessage(replyToken, text) {
  await axios.post(`${LINE_API}/reply`, {
    replyToken,
    messages: [{ type: 'text', text }],
  }, { headers: getHeaders() })
}

export async function pushMessage(lineUserId, text) {
  await axios.post(`${LINE_API}/push`, {
    to: lineUserId,
    messages: [{ type: 'text', text }],
  }, { headers: getHeaders() })
}
