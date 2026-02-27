function getBotToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
}

export async function sendTelegramMessage(chatId, text) {
  const token = getBotToken();
  const cid = String(chatId || '').trim();
  const msg = String(text || '').trim();
  if (!token || !cid || !msg) return false;

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: cid,
      text: msg,
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) return false;
  return true;
}

