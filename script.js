/***************************************************
 * 1. SVG Icons for Arrows (Right & Down)
 ***************************************************/
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
 ***************************************************/
let isAdvancedOpen   = false; // Tracks advanced settings visibility
let onlineTimeOffset = 0;     // Offset from fetched online time
let totpIntervalId   = null;  // Interval ID for TOTP updates
let fetchAnimationId = null;  // Interval for "fetching" text animation

/***************************************************
 * 4. Utility: Base32 Decode (RFC 4648)
 ***************************************************/
function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const sanitized = input
    .replace(/=+$/, "")
    .toUpperCase()
    .replace(/[^A-Z2-7]+/g, "");

  let bits = "";
  const output = [];

  for (let i = 0; i < sanitized.length; i++) {
    const val = alphabet.indexOf(sanitized[i]);
    if (val === -1) {
      throw new Error("Invalid character found in Base32 string.");
    }
    bits += val.toString(2).padStart(5, "0");
  }

  for (let j = 0; j + 7 < bits.length; j += 8) {
    output.push(parseInt(bits.substr(j, 8), 2));
  }

  return new Uint8Array(output);
}

/***************************************************
 * 5. Utility: Generate HMAC with Web Crypto
 ***************************************************/
async function hmacSign(keyBytes, msgBytes, algorithm) {
  const algoKey = { name: "HMAC", hash: { name: algorithm } };
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    algoKey,
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBytes);
  return new Uint8Array(signature);
}

/***************************************************
 * 6. TOTP Generation
 ***************************************************/
async function generateTOTP(secret, timeNow, digits, period, algorithm) {
  const keyBytes = base32Decode(secret);
  const timeStep = Math.floor(timeNow / period);

  const msgBytes = new ArrayBuffer(8);
  const msgView  = new DataView(msgBytes);
  msgView.setUint32(4, timeStep);

  const hmac   = await hmacSign(keyBytes, msgBytes, algorithm);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset]     & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) <<  8) |
    ((hmac[offset + 3] & 0xff));

  const fullCode = binCode % (10 ** digits);
  return String(fullCode).padStart(digits, "0");
}

/***************************************************
 * 7. Get Current Unix Time
 ***************************************************/
function getUnixTime() {
  return Math.floor((Date.now() + onlineTimeOffset) / 1000);
}

/***************************************************
 * 8. Animated "Fetching online time" text
 ***************************************************/
function startFetchingAnimation() {
  const dotPatterns = ["(.)", "(..)", "(...)"];
  let dotIndex = 0;

  if (fetchAnimationId) {
    clearInterval(fetchAnimationId);
  }

  fetchAnimationId = setInterval(() => {
    timeSourceStatus.textContent = `Fetching online time ${dotPatterns[dotIndex]}`;
    dotIndex = (dotIndex + 1) % dotPatterns.length;
  }, 500);
}

function stopFetchingAnimation() {
  if (fetchAnimationId) {
    clearInterval(fetchAnimationId);
    fetchAnimationId = null;
  }
}

/***************************************************
 * 9. Fetch Online Time (TimeAPI.io)
 ***************************************************/
async function fetchOnlineTime() {
  const response = await fetch("https://www.timeapi.io/api/Time/current/zone?timeZone=UTC");
  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }
  const data = await response.json();

  // Build a UTC timestamp from date/time fields
  const serverUnixMs = Date.UTC(
    data.year,
    data.month - 1,
    data.day,
    data.hour,
    data.minute,
    data.seconds,
    data.milliSeconds
  );
  return serverUnixMs;
}

/***************************************************
 * 10. Handle Time Source Changes
 ***************************************************/
async function handleTimeSourceChange() {
  onlineTimeOffset = 0;

  if (timeSourceSelect.value === "device") {
    stopFetchingAnimation();
    timeSourceStatus.textContent = "Using device time";
  } else if (timeSourceSelect.value === "online") {
    startFetchingAnimation();
    try {
      const serverMs = await fetchOnlineTime();
      onlineTimeOffset = serverMs - Date.now();
      timeSourceStatus.textContent = "Using online time (TimeAPI.io)";
    } catch (err) {
      console.error("Failed to fetch online time:", err);
      onlineTimeOffset       = 0;
      timeSourceSelect.value = "device";
      timeSourceStatus.textContent = "Failed to fetch online time. Using device time.";
    } finally {
      stopFetchingAnimation();
    }
  }

  updateURLParams();
  updateTOTPDisplay();
}

/***************************************************
 * 11. Update TOTP Display
 ***************************************************/
async function updateTOTPDisplay() {
  const secret    = secretInput.value.trim();
  const digits    = parseInt(digitsInput.value, 10);
  const period    = parseInt(periodInput.value, 10);
  const algorithm = algorithmSelect.value;

  if (!secret) {
    currentTOTPElem.textContent = "------";
    nextTOTPElem.textContent    = "Next: ------";
    countdownElem.textContent   = "Valid for --s";
    return;
  }

  const unixTime    = getUnixTime();
  const currentStep = Math.floor(unixTime / period);
  const nextStep    = (currentStep + 1) * period;

  try {
    const currentCode = await generateTOTP(secret, unixTime, digits, period, algorithm);
    currentTOTPElem.textContent = currentCode;

    const nextCode = await generateTOTP(secret, nextStep, digits, period, algorithm);
    nextTOTPElem.textContent = `Next: ${nextCode}`;

    const secondsLeft = nextStep - unixTime;
    countdownElem.textContent = `Valid for ${secondsLeft}s`;
  } catch (err) {
    console.error("Error generating TOTP:", err);
    currentTOTPElem.textContent = "Error";
    nextTOTPElem.textContent    = "Next: Error";
    countdownElem.textContent   = "Valid for --s";
  }
}

/***************************************************
 * 12. Update URL Params (Shareable Link)
 ***************************************************/
function updateURLParams() {
  const params = new URLSearchParams();
  params.set("secret",     secretInput.value.trim());
  params.set("digits",     digitsInput.value);
  params.set("period",     periodInput.value);
  params.set("algorithm",  algorithmSelect.value);
  params.set("timeSource", timeSourceSelect.value);

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, "", newURL);
}

/***************************************************
 * 13. Load Config from URL
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
 * 14. Auto-Open Advanced if Non-Default
 *     Default is digits=6, period=30, algorithm=SHA-1
 ***************************************************/
function openOrCloseAdvancedPanel() {
  const defaultDigits     = 6;
  const defaultPeriod     = 30;
  const defaultAlgorithm  = "SHA-1";

  // Compare the current inputs against the defaults
  const isNonDefault =
    parseInt(digitsInput.value, 10) !== defaultDigits ||
    parseInt(periodInput.value, 10) !== defaultPeriod ||
    algorithmSelect.value !== defaultAlgorithm;

  // If user settings differ from defaults, show the advanced panel
  if (isNonDefault) {
    isAdvancedOpen = true;
    advancedSettings.style.display = "block";
    toggleArrow.innerHTML = arrowDownSVG;
    toggleText.textContent = "Hide Advanced Settings";
  } else {
    isAdvancedOpen = false;
    advancedSettings.style.display = "none";
    toggleArrow.innerHTML = arrowRightSVG;
    toggleText.textContent = "Show Advanced Settings";
  }
}

/***************************************************
 * 15. Event Listeners
 ***************************************************/
toggleAdvanced.addEventListener("click", () => {
  isAdvancedOpen = !isAdvancedOpen;
  advancedSettings.style.display = isAdvancedOpen ? "block" : "none";
  toggleArrow.innerHTML = isAdvancedOpen ? arrowDownSVG : arrowRightSVG;
  toggleText.textContent = isAdvancedOpen
    ? "Hide Advanced Settings"
    : "Show Advanced Settings";
});

timeSourceSelect.addEventListener("change", handleTimeSourceChange);

[secretInput, digitsInput, periodInput, algorithmSelect].forEach(el => {
  el.addEventListener("input", () => {
    updateURLParams();
    updateTOTPDisplay();
    // (Optional) If you want the advanced panel to open 
    // immediately when user changes from default, you could 
    // also call openOrCloseAdvancedPanel() here.
  });
});

copyBtn.addEventListener("click", async () => {
  const totpValue = currentTOTPElem.textContent.trim();
  if (totpValue && totpValue !== "------" && totpValue !== "Error") {
    try {
      await navigator.clipboard.writeText(totpValue);
      copyBtn.classList.add("copied");
      setTimeout(() => copyBtn.classList.remove("copied"), 1000);
    } catch (err) {
      console.error("Failed to copy TOTP:", err);
    }
  }
});

shareBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareBtn.classList.add("copied");
    setTimeout(() => shareBtn.classList.remove("copied"), 1000);
  } catch (err) {
    console.error("Failed to copy URL:", err);
  }
});

/***************************************************
 * 16. Initialization
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

// 1) Load config from URL
loadConfigFromURL();

// 2) Check if the advanced settings differ from default
openOrCloseAdvancedPanel();

// 3) If "online" was chosen in URL, fetch time
if (timeSourceSelect.value === "online") {
  handleTimeSourceChange().catch(err => console.error(err));
} else {
  timeSourceStatus.textContent = "Using device time";
}

// 4) Start TOTP auto-refresh
totpIntervalId = setInterval(() => {
  updateTOTPDisplay();
}, 1000);

// 5) First-time TOTP refresh
updateTOTPDisplay();
