# ItemGetter - Shopee Live Item Count API

A Node.js API server that retrieves the item count from Shopee live sessions using Playwright automation.

## Features

- Automates browser interaction to access Shopee live sessions
- Intercepts API responses to extract item count
- Simple REST API endpoint
- Error handling and timeout management

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Chrome, Chromium, or Edge browser installed

## Installation

1. Install dependencies:
```bash
npm install
```

## Setup - Launch Browser with CDP

Before starting the server, you need to launch your browser with remote debugging enabled. This allows Playwright to connect to a real browser instance, which is much harder to detect than an automated browser.

**Important:** Close all instances of your browser before launching with CDP, or it will fail to start.

### Option 1: Chrome/Chromium (Windows)

```bash
# Close all Chrome instances first, then run:
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Google\Chrome\User Data"
```

Or with PowerShell:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\Google\Chrome\User Data"
```

### Option 2: Chrome/Chromium (Mac)

```bash
# Close all Chrome instances first, then run:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="$HOME/Library/Application Support/Google/Chrome"
```

### Option 3: Chrome/Chromium (Linux)

```bash
# Close all Chrome instances first, then run:
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/google-chrome"
```

### Option 4: Microsoft Edge (Windows)

```bash
# Close all Edge instances first, then run:
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="%LOCALAPPDATA%\Microsoft\Edge\User Data"
```

Or with PowerShell:
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\Microsoft\Edge\User Data"
```

**Note:** Using the real user data directory means you'll use your actual browser profile with all your cookies, extensions, and settings. This is the best approach for anti-detection.

## Usage

1. **First, launch your browser with CDP** (see Setup above)

2. **Start the server:**
```bash
npm start
```

Or with a custom CDP endpoint:
```bash
CDP_ENDPOINT=http://localhost:9222 npm start
```

The server will run on `http://localhost:3000` by default.

2. Make a request to get item count:
```bash
GET http://localhost:3000/api/items-count/:sessionId
```

### Example

```bash
curl http://localhost:3000/api/items-count/176778196
```

Response:
```json
{
  "sessionId": 176778196,
  "itemsCount": 9,
  "success": true
}
```

## API Endpoints

### GET `/api/items-count/:sessionId`
Returns the item count for a given Shopee live session.

**Parameters:**
- `sessionId` (path parameter): The Shopee live session ID

**Response:**
```json
{
  "sessionId": 176778196,
  "itemsCount": 9,
  "success": true
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "success": false
}
```

### GET `/health`
Health check endpoint.

### GET `/`
Returns API information and usage instructions.

## How It Works

1. The server receives a session ID via the API endpoint
2. Playwright connects to an existing real browser via CDP (Chrome DevTools Protocol)
3. The browser uses cookies from its real data directory (your actual browser profile)
4. Human-like interactions (mouse movements, scrolling, random delays) are simulated
5. The video element is clicked to trigger the live session
6. The server intercepts the network request to `/api/v1/session/{sessionId}/joinv2`
7. The `items_cnt` value is extracted from the API response
8. The item count is returned to the client

## Environment Variables

- `PORT`: Server port (default: 3000)
- `CDP_ENDPOINT`: CDP endpoint URL (default: `http://localhost:9222`)

## Opening Port in Windows Firewall

Since the server listens on `0.0.0.0` to accept connections from outside, you need to open the port in Windows Firewall.

### Method 1: Using PowerShell (Recommended - Run as Administrator)

```powershell
# Open port 3000 (or your custom PORT)
New-NetFirewallRule -DisplayName "ItemGetter API Server" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Method 2: Using Command Prompt (Run as Administrator)

```cmd
netsh advfirewall firewall add rule name="ItemGetter API Server" dir=in action=allow protocol=TCP localport=3000
```

### Method 3: Using Windows Firewall GUI

1. Open **Windows Defender Firewall** (search in Start menu)
2. Click **Advanced settings** on the left
3. Click **Inbound Rules** → **New Rule...**
4. Select **Port** → Click **Next**
5. Select **TCP** and enter your port number (default: **3000**) → Click **Next**
6. Select **Allow the connection** → Click **Next**
7. Check all profiles (Domain, Private, Public) → Click **Next**
8. Name it "ItemGetter API Server" → Click **Finish**

### Verify Port is Open

After opening the port, verify it's accessible:

```powershell
# Check if port is listening
netstat -an | findstr :3000
```

### Finding Your Server IP Address

To access the server from outside, you need your RDP server's IP address:

```cmd
# Get your local IP address
ipconfig
```

Look for **IPv4 Address** under your network adapter. Use this IP to access your API:
- `http://YOUR_IP:3000/api/items-count/176778196`

**Note:** If your RDP server is behind a router, you may also need to configure port forwarding on your router.

## Notes

- **Uses real browser via CDP** - This is the best anti-detection method as it uses your actual installed browser (Chrome/Edge) without automation flags
- **Uses real browser profile** - Cookies are automatically loaded from your browser's data directory, so no need for `cookie.txt`
- Simulates human-like behavior with random delays, mouse movements, and scrolling
- Request timeout is set to 15 seconds
- The browser must be launched with `--remote-debugging-port=9222` before starting the server
- The server reuses existing browser tabs/contexts when available

