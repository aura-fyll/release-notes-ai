// src/pro.js — Pro tier: license validation via Polar.sh + broadcast via Composio
//
// Polar.sh is built for OSS/dev tools. Native license keys, free to start,
// 4% + $0.40 per transaction. Sign up at https://polar.sh
//
// To enable:
//   1. Create a product on Polar.sh (type: "Subscription", $9/month)
//   2. Copy your product ID (in the Polar dashboard URL)
//   3. Set env var POLAR_PRODUCT_ID (or hardcode below)
//   4. Polar handles license key generation automatically on purchase
//
// License validation API: https://docs.polar.sh/api/products/license-keys/validate

const POLAR_PRODUCT_ID = process.env.POLAR_PRODUCT_ID || '79f4e3a7-6ff9-4ee9-9d56-a423dc646587';

/**
 * Validate a Polar.sh license key.
 * Polar returns: { valid: boolean, status: 'valid' | 'invalid' | 'expired' | 'revoked', ... }
 */
async function validateLicense(licenseKey) {
  if (!licenseKey || licenseKey.trim().length < 10) return false;
  try {
    const res = await fetch('https://api.polar.sh/v1/license-keys/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: licenseKey.trim(),
        // Optionally pin to your product to prevent cross-product key reuse
        product_id: POLAR_PRODUCT_ID,
      }),
    });
    if (!res.ok) {
      console.warn(`Polar license validation HTTP ${res.status}`);
      return false;
    }
    const data = await res.json();
    // Polar returns { valid: true/false, status: "valid"|"expired"|"revoked"|"invalid" }
    return data.valid === true && data.status === 'valid';
  } catch (err) {
    console.warn('License validation failed:', err.message);
    return false;
  }
}

/**
 * Broadcast release notes to connected channels via Composio.
 *
 * Composio manages the OAuth dance — users connect their Slack/Discord/etc.
 * accounts on a Composio-hosted page, then we call execute_action.
 *
 * User setup:
 *   - Connect once via Composio's auth page
 *   - Paste connected_account_id as repo secret: COMPOSIO_ACCOUNT_ID
 *   - We use it to execute the broadcast action
 */
async function broadcastIfPro({ composioKey, channels, owner, repo, tag, releaseUrl, notes }) {
  const accountId = process.env.COMPOSIO_ACCOUNT_ID || '';
  if (!accountId) {
    console.warn('⚠️  COMPOSIO_ACCOUNT_ID env var not set. Cannot broadcast.');
    return;
  }

  // Truncate notes for chat channels (Slack/Discord have message limits)
  const shortNotes = notes.length > 2800 ? notes.slice(0, 2800) + '\n\n…(truncated, see full notes on GitHub)' : notes;
  const message = `🚀 *${owner}/${repo} ${tag}*\n\n${shortNotes}\n\nFull release: ${releaseUrl}`;

  const failures = [];

  for (const channel of channels) {
    try {
      const result = await broadcastToChannel({ composioKey, accountId, channel, message, owner, repo, tag, releaseUrl });
      console.log(`✅ Broadcast to ${channel}: ${result.status}`);
    } catch (err) {
      console.warn(`❌ Broadcast to ${channel} failed: ${err.message}`);
      failures.push(channel);
    }
  }

  if (failures.length) {
    console.warn(`⚠️  ${failures.length} channel(s) failed: ${failures.join(', ')}`);
  }
}

async function broadcastToChannel({ composioKey, accountId, channel, message, owner, repo, tag, releaseUrl }) {
  // Composio API: https://docs.composio.dev
  const actionMap = {
    slack: 'SLACK_SEND_MESSAGE',
    discord: 'DISCORD_SEND_MESSAGE',
    email: 'GMAIL_SEND_EMAIL',
    twitter: 'TWITTER_CREATE_TWEET',
  };
  const actionName = actionMap[channel];
  if (!actionName) throw new Error(`Unknown channel: ${channel}`);

  let params;
  if (channel === 'slack') {
    params = { channel: process.env.SLACK_CHANNEL || '#releases', text: message };
  } else if (channel === 'discord') {
    params = { channel_id: process.env.DISCORD_CHANNEL_ID, content: message };
  } else if (channel === 'email') {
    params = { to: process.env.EMAIL_TO, subject: `Release ${tag}: ${owner}/${repo}`, body: message };
  } else if (channel === 'twitter') {
    const teaser = `🚀 ${owner}/${repo} ${tag} released\n\n${releaseUrl}`;
    params = { text: teaser.slice(0, 280) };
  }

  const res = await fetch('https://backend.composio.dev/api/v2/actions/execute', {
    method: 'POST',
    headers: {
      'x-api-key': composioKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionName,
      connectedAccountId: accountId,
      input: params,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Composio ${res.status}: ${errText}`);
  }
  return { status: 'ok', response: await res.json() };
}

module.exports = { validateLicense, broadcastIfPro };
