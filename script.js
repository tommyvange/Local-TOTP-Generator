const arrowRightSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
  <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5
           -32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 
           0-32 14.3-32 32s14.3 32 32 32h306.7L233.4 393.4c-12.5 12.5
           -12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z"/>
</svg>
`;

const arrowDownSVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
  <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 
           12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8V64c0-17.7
           -14.3-32-32-32s-32 14.3-32 32v306.7L54.6 265.4c-12.5-12.5
           -32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
</svg>
`;

/***************************************************
 * 2. DOM Element References
 *    Grabbing important elements from the HTML.
 ***************************************************/
const timeSourceSelect  = document.getElementById("timeSource");
const timeSourceStatus  = document.getElementById("timeSourceStatus");
const secretInput       = document.getElementById("secret");
const digitsInput       = document.getElementById("digits");
const periodInput       = document.getElementById("period");
const algorithmSelect   = document.getElementById("algorithm");

const toggleAdvanced    = document.getElementById("toggleAdvanced");
const toggleArrow       = document.getElementById("toggleArrow");
const toggleText        = document.getElementById("toggleText");
const advancedSettings  = document.getElementById("advancedSettings");

const countdownElem     = document.getElementById("countdown");
const currentTOTPElem   = document.getElementById("currentTOTP");
const nextTOTPElem      = document.getElementById("nextTOTP");

const copyBtn           = document.getElementById("copyBtn");
const shareBtn          = document.getElementById("shareBtn");

/***************************************************
 * 3. State & Config
 *    Holds internal state for toggles and intervals.
 ***************************************************/
let isAdvancedOpen = false;    // Tracks advanced settings visibility
let onlineTimeOffset = 0;      // Offset from online time (if used)
let totpIntervalId = null;     // Interval ID for updating TOTP continuously

/***************************************************
 * 4. Utility: Base32 Decode
 *    Decodes a Base32 string (RFC 4648) into a Uint8Array.
 ***************************************************/
function base32Decode(input) {
  // Allowed Base32 Alphabet
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  // Remove any trailing "=" padding, uppercase, and strip invalid chars
  const sanitized = input
    .replace(/=+$/, "")
    .toUpperCase()
    .replace(/[^A-Z2-7]+/g, "");

  let bits = "";
  const output = [];

  // Convert each character to a 5-bit binary string
  for (let i = 0; i < sanitized.length; i++) {
    const val = alphabet.indexOf(sanitized[i]);
    if (val === -1) {
      throw new Error("Invalid character found in Base32 string.");
    }
    bits += val.toString(2).padStart(5, "0");
  }

  // Split the concatenated bits into bytes
  for (let j = 0; j + 7 < bits.length; j += 8) {
    output.push(parseInt(bits.substr(j, 8), 2));
  }

  return new Uint8Array(output);
}

/***************************************************
 * 5. Utility: Generate HMAC with Web Crypto
 *    Returns a Uint8Array of the HMAC signature.
 ***************************************************/
async function hmacSign(keyBytes, msgBytes, algorithm) {
  // Algorithm specification recognized by Web Crypto
  const algoKey = { name: "HMAC", hash: { name: algorithm } };

  // Import the raw key bytes as an HMAC key
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    algoKey,
    false,
    ["sign"]
  );

  // Perform the HMAC "sign" operation
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes);
  return new Uint8Array(signature);
}

/***************************************************
 * 6. TOTP Generation
 *    Generates a TOTP code (string) given user config.
 ***************************************************/
async function generateTOTP(secret, timeNow, digits, period, algorithm) {
  // 1. Convert secret from Base32 → raw bytes
  const keyBytes = base32Decode(secret);

  // 2. Calculate the time step
  const timeStep = Math.floor(timeNow / period);

  // 3. Convert time step to an 8-byte ArrayBuffer (big-endian)
  const msgBytes = new ArrayBuffer(8);
  const msgView = new DataView(msgBytes);
  // Only set lower 32 bits
  msgView.setUint32(4, timeStep);

  // 4. Compute the HMAC value
  const hmac = await hmacSign(keyBytes, msgBytes, algorithm);

  // 5. Dynamic Truncation
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
    ((hmac[offset + 3] & 0xff));

  // 6. Modulo to get the code, and then zero-pad
  const fullCode = binCode % (10 ** digits);
  return String(fullCode).padStart(digits, "0");
}

/***************************************************
 * 7. Get Current Unix Time (Device vs. Online)
 *    Returns current time in seconds, adjusted by offset.
 ***************************************************/
function getUnixTime() {
  const nowMs = Date.now() + onlineTimeOffset;  // Adjust by offset if using online time
  return Math.floor(nowMs / 1000);
}

/***************************************************
 * 8. Fetch Online Time (Optional)
 *    Example uses WorldTimeAPI to set 'onlineTimeOffset'.
 ***************************************************/
async function fetchOnlineTimeOffset() {
  try {
    const response = await fetch("https://worldtimeapi.org/api/timezone/etc/utc");
    if (!response.ok) {
      throw new Error("Network response was not ok.");
    }
    const data = await response.json();
    const utcTimeFromAPI = new Date(data.utc_datetime).getTime(); // ms
    const localNow = Date.now();

    // Calculate the difference between reported online UTC and local system time
    onlineTimeOffset = utcTimeFromAPI - localNow;
    timeSourceStatus.textContent = "Using online time (WorldTimeAPI)";
  } catch (err) {
    console.warn("Failed to fetch online time:", err);
    // Fallback to device time
    onlineTimeOffset = 0;
    timeSourceSelect.value = "device";
    timeSourceStatus.textContent = "Using device time (fallback)";
  }
}

/***************************************************
 * 9. Update TOTP Display
 *    Refreshes the displayed current TOTP and next TOTP.
 ***************************************************/
async function updateTOTPDisplay() {
  const secret    = secretInput.value.trim();
  const digits    = parseInt(digitsInput.value, 10);
  const period    = parseInt(periodInput.value, 10);
  const algorithm = algorithmSelect.value;

  // If secret is empty or invalid, show placeholders
  if (!secret) {
    currentTOTPElem.textContent = "------";
    nextTOTPElem.textContent    = "Next: ------";
    countdownElem.textContent   = "Valid for --s";
    return;
  }

  const unixTime = getUnixTime();
  // Current time step
  const currentStep = Math.floor(unixTime / period);
  // The next step starts at:
  const nextStepTime = (currentStep + 1) * period;

  try {
    // Generate current TOTP
    const currentCode = await generateTOTP(secret, unixTime, digits, period, algorithm);
    currentTOTPElem.textContent = currentCode;

    // Generate the next TOTP for preview
    const nextCode = await generateTOTP(secret, nextStepTime, digits, period, algorithm);
    nextTOTPElem.textContent = `Next: ${nextCode}`;

    // Countdown until next TOTP
    const secondsLeft = nextStepTime - unixTime;
    countdownElem.textContent = `Valid for ${secondsLeft}s`;
  } catch (err) {
    console.error("Error generating TOTP:", err);
    // If there's an error (e.g. invalid base32), show error placeholders
    currentTOTPElem.textContent = "Error";
    nextTOTPElem.textContent    = "Next: Error";
    countdownElem.textContent   = "Valid for --s";
  }
}

/***************************************************
 * 10. Update URL Params (Shareable Link)
 *     Reflects current fields in the query string.
 ***************************************************/
function updateURLParams() {
  const params = new URLSearchParams();
  params.set("secret", secretInput.value.trim());
  params.set("digits", digitsInput.value);
  params.set("period", periodInput.value);
  params.set("algorithm", algorithmSelect.value);
  params.set("timeSource", timeSourceSelect.value);

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", newURL);
}

/***************************************************
 * 11. Load Config from URL
 *     Reads query params and updates form fields.
 ***************************************************/
function loadConfigFromURL() {
  const params = new URLSearchParams(window.location.search);

  if (params.has("secret")) {
    secretInput.value = params.get("secret");
  }
  if (params.has("digits")) {
    digitsInput.value = params.get("digits");
  }
  if (params.has("period")) {
    periodInput.value = params.get("period");
  }
  if (params.has("algorithm")) {
    algorithmSelect.value = params.get("algorithm");
  }
  if (params.has("timeSource")) {
    timeSourceSelect.value = params.get("timeSource");
  }
}

/***************************************************
 * 12. Event Handlers
 *     Interactions for toggles, input changes, copy, etc.
 ***************************************************/

// Toggle the visibility of advanced settings
toggleAdvanced.addEventListener("click", () => {
  isAdvancedOpen = !isAdvancedOpen;
  advancedSettings.style.display = isAdvancedOpen ? "block" : "none";

  // Swap the arrow icon
  toggleArrow.innerHTML = isAdvancedOpen ? arrowDownSVG : arrowRightSVG;

  // Update the toggle text
  toggleText.textContent = isAdvancedOpen
    ? "Hide Advanced Settings"
    : "Show Advanced Settings";
});

// Handle time source changes (device vs. online)
timeSourceSelect.addEventListener("change", async () => {
  const selected = timeSourceSelect.value;
  if (selected === "online") {
    await fetchOnlineTimeOffset();
  } else {
    onlineTimeOffset = 0;
    timeSourceStatus.textContent = "Using device time";
  }

  updateURLParams();
  updateTOTPDisplay(); // Refresh TOTP display immediately
});

// Update TOTP and URL whenever relevant inputs change
[secretInput, digitsInput, periodInput, algorithmSelect].forEach((el) => {
  el.addEventListener("input", () => {
    updateURLParams();
    updateTOTPDisplay();
  });
});

// Copy TOTP button
copyBtn.addEventListener("click", async () => {
  const totpValue = currentTOTPElem.textContent.trim();
  // Ensure there's a valid TOTP to copy
  if (totpValue && totpValue !== "------" && totpValue !== "Error") {
    try {
      await navigator.clipboard.writeText(totpValue);
      // Temporary feedback by changing button color
      copyBtn.classList.add("copied");
      setTimeout(() => copyBtn.classList.remove("copied"), 1000);
    } catch (err) {
      console.error("Failed to copy TOTP:", err);
    }
  }
});

// Copy URL button
shareBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    // Temporary feedback by changing button color
    shareBtn.classList.add("copied");
    setTimeout(() => shareBtn.classList.remove("copied"), 1000);
  } catch (err) {
    console.error("Failed to copy URL:", err);
  }
});

/***************************************************
 * 13. Initialization
 *     Sets up the UI based on URL, time source, etc.
 ***************************************************/

// Styled disclaimer message
console.log(
  '%cDISCLAIMER: %cFor your security, never paste anything into the browser console unless you are absolutely sure what you are doing.',
  'color: red; font-weight: bold; font-size: 20px;margin-top: 15px;',
  'color: yellow; font-weight: normal; font-size: 18px;margin-bottom: 15px;'
);

// Styled personal boast message
console.log(
  '%cThis projected was created with ❤️ by Tommy Vange Rød' +
  '%c\n\n\nLinkedIn Profile: %chttps://www.linkedin.com/in/tommyvange/' +
  '%c\nGitHub Profile: %chttps://github.com/tommyvange',
  'color: #fff; background: #007BFF; padding: 4px 8px; border-radius: 4px; font-size: 16px;margin-top: 15px;',
  'color: #007BFF; font-style: italic; font-size: 14px;',
  'color: #1d6f42; text-decoration: underline; font-size: 14px;',
  'color: #007BFF; font-style: italic; font-size: 14px;',
  'color: #1d6f42; text-decoration: underline; font-size: 14px;margin-bottom: 15px;'
);

// Project links
console.log(
  '%cThe project is 100%% open-source, licensed under GPL-3.0 and hosted via Cloudflare Pages.' +
  '%c\n\n\nProject: %chttps://github.com/tommyvange/Local-TOTP-Generator' +
  '%c\nLicense: %chttps://github.com/tommyvange/Local-TOTP-Generator/blob/main/LICENSE' +
  '%c\nCloudflare Pages: %chttps://pages.cloudflare.com/',
  'color: #007BFF; font-size: 14px;margin-top: 15px;',
  'color: #007BFF; font-style: italic; font-size: 14px;',
  'color: #1d6f42; text-decoration: underline; font-size: 14px;',
  'color: #007BFF; font-style: italic; font-size: 14px;',
  'color: #1d6f42; text-decoration: underline; font-size: 14px;',
  'color: #007BFF; font-style: italic; font-size: 14px;',
  'color: #1d6f42; text-decoration: underline; font-size: 14px;margin-bottom: 15px;'
);


// 1) Load config from URL to populate form fields
loadConfigFromURL();

// 2) If online time is selected, fetch offset
if (timeSourceSelect.value === "online") {
  fetchOnlineTimeOffset().then(() => {
    updateTOTPDisplay();
  });
} else {
  timeSourceStatus.textContent = "Using device time";
}

// 3) Initialize advanced settings toggle (collapsed by default)
toggleArrow.innerHTML = arrowRightSVG;
advancedSettings.style.display = "none";

// 4) Start an interval to continuously update the TOTP
totpIntervalId = setInterval(() => {
  updateTOTPDisplay();
}, 1000);

// 5) Perform an immediate refresh on load
updateTOTPDisplay();
