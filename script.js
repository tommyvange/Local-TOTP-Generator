/*************************************************************
 *                   BASE32, HMAC & TOTP LOGIC
 *************************************************************/

// Decode a Base32-encoded secret
function base32Decode(input) {
  const sanitized = input.toUpperCase().replace(/[^A-Z2-7]+=*$/g, '');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let output = [];

  for (let i = 0; i < sanitized.length; i++) {
    const val = alphabet.indexOf(sanitized.charAt(i));
    if (val === -1) {
      throw new Error('Invalid Base32 character.');
    }
    bits += val.toString(2).padStart(5, '0');
  }

  for (let j = 0; j < bits.length; j += 8) {
    const byte = bits.substring(j, j + 8);
    if (byte.length === 8) {
      output.push(parseInt(byte, 2));
    }
  }
  return new Uint8Array(output);
}

// Convert a number to an 8-byte (big-endian) array
function intToBuffer(num) {
  const buffer = new ArrayBuffer(8);
  const dataView = new DataView(buffer);
  dataView.setUint32(0, Math.floor(num / 4294967296), false); // high
  dataView.setUint32(4, num >>> 0, false);                    // low
  return new Uint8Array(buffer);
}

// HMAC using Web Crypto
async function hmacSign(key, msg, algorithm) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msg);
  return new Uint8Array(sig);
}

// Generate TOTP code
// nowMs => current Unix time in ms (UTC-based)
async function generateTOTP(secretBase32, digits, period, algorithm, nowMs) {
  const secret = base32Decode(secretBase32);
  const currentTime = Math.floor(nowMs / 1000);
  const counter = Math.floor(currentTime / period);

  const counterBuffer = intToBuffer(counter);
  const hmac = await hmacSign(secret, counterBuffer, algorithm);

  // Dynamic Truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8)  |
      (hmac[offset + 3] & 0xff);

  // Zero-pad to desired digits
  const otp = (binaryCode % Math.pow(10, digits))
    .toString()
    .padStart(digits, '0');
  return otp;
}

/*************************************************************
 *                TIME SOURCE (Device vs. Online)
 *************************************************************/

// We'll store an offset: (serverUnixMs) - (Date.now())
let timeOffset = 0;  // 0 => using device time exactly

/**
 * Fetch time from timeapi.io in UTC, 
 * then build the correct UTC date from numeric fields
 */
async function fetchOnlineTime() {
  const response = await fetch('https://www.timeapi.io/api/Time/current/zone?timeZone=UTC');
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }
  const data = await response.json();
  // data = {
  //   "year":2025,"month":2,"day":5,
  //   "hour":9,"minute":39,"seconds":32,
  //   "milliSeconds":449,
  //   "dateTime":"2025-02-05T09:39:32.4491594",
  //   ...
  // }
  
  // Construct a Date in UTC from numeric fields
  // (months in JS are 0-based, so subtract 1 from data.month)
  const serverUnixMs = Date.UTC(
    data.year,
    data.month - 1,
    data.day,
    data.hour,
    data.minute,
    data.seconds,
    data.milliSeconds
  );

  return serverUnixMs; // ms since 1970-01-01 UTC
}

/*************************************************************
 *             DOM ELEMENT REFERENCES
 *************************************************************/
const timeSourceEl = document.getElementById('timeSource');
const timeSourceStatusEl = document.getElementById('timeSourceStatus');

const secretEl = document.getElementById('secret');
const digitsEl = document.getElementById('digits');
const periodEl = document.getElementById('period');
const algorithmEl = document.getElementById('algorithm');

const currentTOTPEl = document.getElementById('currentTOTP');
const nextTOTPEl = document.getElementById('nextTOTP');
const countdownEl = document.getElementById('countdown');

const copyBtn = document.getElementById('copyBtn');
const shareBtn = document.getElementById('shareBtn');

let intervalId = null;

/*************************************************************
 *           READ/WRITE URL PARAMS & TOTP UPDATE
 *************************************************************/
function readParamsFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('secret')) {
    secretEl.value = params.get('secret');
  }
  if (params.has('digits')) {
    digitsEl.value = params.get('digits');
  }
  if (params.has('period')) {
    periodEl.value = params.get('period');
  }
  if (params.has('algorithm')) {
    algorithmEl.value = params.get('algorithm');
  }
}

function updateURLParams() {
  const params = new URLSearchParams({
    secret: secretEl.value.trim(),
    digits: digitsEl.value,
    period: periodEl.value,
    algorithm: algorithmEl.value
  });
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Calculate and display TOTP codes using the current config + timeOffset
 */
async function updateTOTP() {
  const secretVal = secretEl.value.trim();
  const digitsVal = parseInt(digitsEl.value, 10);
  const periodVal = parseInt(periodEl.value, 10);
  const algorithmVal = algorithmEl.value;

  if (!secretVal) {
    currentTOTPEl.textContent = '------';
    nextTOTPEl.textContent = 'Next: ------';
    countdownEl.textContent = 'Valid for --s';
    return;
  }

  // Now in ms, adjusted by offset
  const nowMs = Date.now() + timeOffset;

  try {
    // Current TOTP
    const current = await generateTOTP(secretVal, digitsVal, periodVal, algorithmVal, nowMs);
    currentTOTPEl.textContent = current;

    // Next TOTP => figure out next step
    const currentTimeSec = Math.floor(nowMs / 1000);
    const nextCounter = Math.floor(currentTimeSec / periodVal) + 1;
    const nextBlockMs = nextCounter * periodVal * 1000; // in ms

    const timeLeft = Math.floor((nextBlockMs - nowMs) / 1000);

    // Actually compute next code
    const next = await generateTOTP(secretVal, digitsVal, periodVal, algorithmVal, nextBlockMs);
    nextTOTPEl.textContent = 'Next: ' + next;

    // Countdown
    countdownEl.textContent = `Valid for ${timeLeft}s`;
  } catch (err) {
    console.error(err);
    currentTOTPEl.textContent = 'Error';
    nextTOTPEl.textContent = 'Next: --';
    countdownEl.textContent = 'Error';
  }
}

/*************************************************************
 *          TIME SOURCE SELECTION (Device vs Online)
 *************************************************************/
async function handleTimeSourceChange() {
  timeOffset = 0; // reset
  if (timeSourceEl.value === 'device') {
    timeSourceStatusEl.textContent = 'Using device time';
  } else if (timeSourceEl.value === 'online') {
    timeSourceStatusEl.textContent = 'Fetching online time...';
    try {
      const serverMs = await fetchOnlineTime();
      timeOffset = serverMs - Date.now();
      timeSourceStatusEl.textContent = 'Using online time (synced once)';
    } catch (error) {
      console.error(error);
      timeOffset = 0;
      timeSourceEl.value = 'device'; // revert
      timeSourceStatusEl.textContent = 'Failed to fetch online time. Using device time.';
    }
  }
  await updateTOTP();
}

/*************************************************************
 *             COPY TOTP & SHARE URL BUTTONS
 *************************************************************/
function showButtonFeedback(button, label) {
  const originalLabel = button.textContent;
  button.classList.add('copied'); // turn green or something
  button.textContent = label;
  setTimeout(() => {
    button.classList.remove('copied');
    button.textContent = originalLabel;
  }, 1000);
}

// Copy TOTP
copyBtn.addEventListener('click', async () => {
  const totpValue = currentTOTPEl.textContent;
  if (!totpValue || totpValue === '------' || totpValue === 'Error') {
    showButtonFeedback(copyBtn, 'No Code');
    return;
  }
  try {
    await navigator.clipboard.writeText(totpValue);
    showButtonFeedback(copyBtn, 'Copied!');
  } catch (err) {
    console.error(err);
    showButtonFeedback(copyBtn, 'Error');
  }
});

// Copy URL
shareBtn.addEventListener('click', async () => {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    showButtonFeedback(shareBtn, 'Copied!');
  } catch (err) {
    console.error(err);
    showButtonFeedback(shareBtn, 'Error');
  }
});

/*************************************************************
 *                        INIT
 *************************************************************/
(async function init() {
  // 1. Load URL params
  readParamsFromURL();

  // 2. Handle field changes => update TOTP
  [secretEl, digitsEl, periodEl, algorithmEl].forEach(el => {
    el.addEventListener('input', async () => {
      updateURLParams();
      await updateTOTP();
    });
    el.addEventListener('paste', async () => {
      updateURLParams();
      await updateTOTP();
    });
  });

  // 3. Time source select
  timeSourceEl.addEventListener('change', handleTimeSourceChange);

  // 4. Initial TOTP
  await updateTOTP();
  intervalId = setInterval(updateTOTP, 1000);
})();
