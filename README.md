
# Local TOTP Generator

[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://opensource.org/licenses/GPL-3.0)

[Local TOTP Generator](https://localtotp.com/) is a secure, offline tool for generating Time-Based One-Time Passwords (TOTPs). It leverages the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to ensure that all cryptographic operations occur locally in your browser—without ever exposing your secret key to a server.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [When is This Tool Useful?](#when-is-this-tool-useful)
- [How It Works](#how-it-works)
- [Usage](#usage)
- [Installation](#installation)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

## Overview

Local TOTP Generator is designed for developers and security-conscious users who need a flexible and reliable TOTP solution. Whether you require the standard 6-digit, 30-second code or need custom settings for specific services, this tool offers the flexibility to match your requirements—all without sending your data over the network.

## Features

- **Offline Generation:** Uses the browser’s native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) to generate TOTPs locally.
- **Customizable Settings:** Adjust the digit length, period (in seconds), and cryptographic algorithm (SHA-1, SHA-256, or SHA-512) to suit your needs.
- **Dual Time Sources:** Choose to rely on your device’s clock or fetch the current time from [TimeAPI.io](https://timeapi.io/).
- **Real-Time Updates:** Displays the current TOTP, the next TOTP, and a live countdown timer.
- **Shareable Configuration:** Easily copy a URL that contains your configuration parameters for quick sharing or backup.
- **Open-Source & Secure:** Licensed under [GPL-3.0](LICENSE) and developed with security in mind.

## When is This Tool Useful?
Local TOTP Generator is a versatile tool that shines in various scenarios. Here are some examples:

#### 1. Third-Party Consultant Access

When you need to provide temporary access to a test account that uses two-factor authentication, the recipient may not have—or want to use—a full-featured password manager. In one instance, I used this tool to send a login to a third-party consultant. Since the account contained only non-critical data, I could easily share a link to the TOTP, simplifying the process and enhancing their ease of access.

#### 2. Quick Testing and Development

For developers and QA teams, setting up multiple authenticator apps for different test accounts can be cumbersome. This tool allows you to rapidly generate TOTPs for any account configured with 2FA, making it an ideal solution for testing authentication flows without extra overhead.

#### 3. Secure Offline TOTP Generation

For users who are security-conscious, generating TOTPs offline means your secret key never leaves your device. This tool leverages the browser’s Web Crypto API to perform all computations locally, ensuring your sensitive data remains secure.

#### 4. Flexibility for Custom Configurations

Sometimes, standard 2FA settings don't meet all requirements. With customizable options such as digit length, period, and algorithm, Local TOTP Generator adapts to unique scenarios—whether you need a non-standard configuration for a specific service or simply want more control over your authentication process.

## How It Works

Local TOTP Generator implements the standard TOTP algorithm as defined in [RFC 6238](https://tools.ietf.org/html/rfc6238):

1. **Base32 Decoding:** Your secret (in Base32 format) is decoded into bytes.
2. **HMAC Calculation:** An HMAC is computed using the selected algorithm and the decoded secret.
3. **Dynamic Truncation:** A section of the HMAC output is extracted to generate the final numeric code.
4. **Display & Refresh:** The TOTP is updated in real time, showing both the current code and the upcoming one, along with a countdown timer.

## Usage

1. **Open the Tool:**
   - Visit [localtotp.com](https://localtotp.com/).   
     *(Cloudflare Pages hosted clone of this repository)* 

2. **Enter Your Secret:**
   - Input your Base32-encoded secret key into the provided field.

3. **(Optional) Configure Advanced Settings:**
   - Click on **"Show Advanced Settings"** to modify parameters like the number of digits, period, and algorithm.  
   - The defaults are set to 6 digits, 30 seconds, and SHA-1.

4. **Select Time Source:**
   - Choose between using your device’s time or fetching the current time online (via TimeAPI.io).

5. **Generate & Copy Codes:**
   - The tool will display the current TOTP, the next TOTP, and a countdown.
   - Use the **"Copy TOTP"** button to copy the current code, or the **"Copy URL"** button to copy a shareable link containing your configuration.

## Installation

To run or modify the Local TOTP Generator locally:

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/tommyvange/Local-TOTP-Generator.git
   cd Local-TOTP-Generator
   ```
   
2.  **Open the Project:**
    -   Open `index.html` in your web browser.
    -   Alternatively, serve the project using your favorite local development server.

## Development

This project is built with plain HTML, CSS, and JavaScript. Key files include:

-   **`index.html`** – The main HTML structure and meta tags for SEO and social sharing.
-   **`script.js`** – Contains all the logic for TOTP generation, time source management, UI interactivity, and event handling.
-   **`style.css`** – Provides a clean, modern, and responsive design, with support for both light and dark modes.

Feel free to explore the codebase, customize it to your needs, and suggest improvements.

## Contributing

Contributions are welcome and appreciated! To contribute:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and test thoroughly.
4.  Submit a pull request with a clear description of your changes.

## License

Local TOTP Generator is released under the [GPL-3.0 License](LICENSE). You are free to use, modify, and distribute this software under the terms of the license. Please ensure that any derivative works are also licensed under [GPL-3.0](LICENSE).


## Credits

### Author

<!-- readme: tommyvange -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/tommyvange">
                    <img src="https://avatars.githubusercontent.com/u/28400191?v=4" width="100;" alt="tommyvange"/>
                    <br />
                    <sub><b>Tommy Vange Rød</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: tommyvange -end -->

You can find more of my work on my [GitHub profile](https://github.com/tommyvange) or connect with me on [LinkedIn](https://www.linkedin.com/in/tommyvange/).

### Contributors

<!-- readme: contributors -start -->
<table>
	<tbody>
		<tr>
            <td align="center">
                <a href="https://github.com/tommyvange">
                    <img src="https://avatars.githubusercontent.com/u/28400191?v=4" width="100;" alt="tommyvange"/>
                    <br />
                    <sub><b>Tommy Vange Rød</b></sub>
                </a>
            </td>
		</tr>
	<tbody>
</table>
<!-- readme: contributors -end -->

----------
