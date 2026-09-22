// Twilio SMS for receipt delivery. No-op (sent:false) when creds or
// numbers are missing, so local/demo runs never crash on SMS.
export async function sendReceiptSms(opts: {
  to: string;
  from: string;
  text: string;
}): Promise<{ sent: boolean; sid?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keyOrSid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_SECRET;
  if (!accountSid || !keyOrSid || !token) return { sent: false, error: "twilio_not_configured" };
  if (!opts.to || !opts.from) return { sent: false, error: "missing_number" };
  // Normalize: keep digits and leading +.
  const to = opts.to.trim().startsWith("+")
    ? opts.to.trim()
    : `+${opts.to.trim().replace(/\D/g, "")}`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyOrSid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: opts.from, Body: opts.text.slice(0, 300) }),
      },
    );
    const data = await res.json();
    if (!res.ok) return { sent: false, error: String(data.message || res.status).slice(0, 120) };
    return { sent: true, sid: data.sid };
  } catch (e) {
    return { sent: false, error: String(e).slice(0, 120) };
  }
}
