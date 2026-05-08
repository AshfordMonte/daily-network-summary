// Minimal Slack incoming-webhook client.

export async function postToSlack(text, webhookUrl = process.env.SLACK_WEBHOOK_URL) {
  if (!webhookUrl) {
    throw new Error('SLACK_WEBHOOK_URL is required to post the report.');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText} - ${responseBody.slice(
        0,
        400
      )}`
    );
  }

  return {
    ok: true,
    status: response.status,
    body: responseBody
  };
}
