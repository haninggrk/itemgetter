const express = require('express');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://localhost:9222';

// Middleware
app.use(express.json());

// API endpoint to get item count
app.get('/api/items-count/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  let browser = null;
  let page = null;
  
  try {
    // Connect to existing browser via CDP (Chrome DevTools Protocol)
    // This uses a real browser instance, which is much harder to detect
    console.log(`Connecting to browser via CDP: ${CDP_ENDPOINT}`);
    try {
      browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (error) {
      throw new Error(`Failed to connect to browser via CDP at ${CDP_ENDPOINT}. Make sure your browser is launched with --remote-debugging-port=9222. Error: ${error.message}`);
    }
    
    // Get the default context (or create a new one if needed)
    const contexts = browser.contexts();
    let context;
    
    if (contexts.length > 0) {
      // Use existing context
      context = contexts[0];
      console.log('Using existing browser context');
    } else {
      // Create new context if none exists
      context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        extraHTTPHeaders: {
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      console.log('Created new browser context');
    }

    // Create a new page for this request (will be closed after use to save RAM)
    page = await context.newPage();
    console.log('Created new page for request');

    // Set up request interception to capture the API response
    let apiResponse = null;
    const apiUrlPattern = new RegExp(`/api/v1/session/${sessionId}/joinv2`);

    page.on('response', async (response) => {
      if (apiUrlPattern.test(response.url())) {
        try {
          apiResponse = await response.json();
        } catch (error) {
          console.error('Error parsing API response:', error);
        }
      }
    });

    // Helper function for random delay (simulates human behavior)
    const randomDelay = (min, max) => {
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      return page.waitForTimeout(delay);
    };

    // Navigate to the Shopee live URL
    const liveUrl = `https://live.shopee.co.id/share?from=live&session=${sessionId}`;
    console.log(`Navigating to: ${liveUrl}`);
    
    await page.goto(liveUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to fully load with random delay
    await randomDelay(2000, 3500);
    
    // Simulate human-like mouse movement
    await page.mouse.move(Math.floor(Math.random() * 500) + 100, Math.floor(Math.random() * 500) + 100);
    await randomDelay(300, 800);
    
    // Scroll a bit to simulate reading
    await page.evaluate(() => {
      window.scrollBy(0, Math.floor(Math.random() * 200) + 50);
    });
    await randomDelay(500, 1000);
    
    // Wait for video element to appear
    console.log('Waiting for video element to appear...');
    try {
      await page.waitForSelector('video', { 
        timeout: 30000, // Wait up to 30 seconds for video element
        state: 'attached' // Element exists in DOM (doesn't need to be visible)
      });
      console.log('Video element found');
    } catch (error) {
      throw new Error('Video element not found within timeout period');
    }
    
    // Wait a bit more for video to be ready
    await randomDelay(1000, 2000);
    
    // Click video element programmatically using browser script
    console.log('Clicking video element programmatically...');
    const videoClicked = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.click();
        return true;
      }
      return false;
    });
    
    if (!videoClicked) {
      throw new Error('Video element not found after waiting');
    }
    
    // Wait a bit after clicking (simulates human reaction time)
    await randomDelay(1000, 2000);

    // Wait for the API request to complete
    console.log('Waiting for API response...');
    let waitTime = 0;
    const maxWaitTime = 30000; // 30 seconds timeout (increased from 15)
    
    while (!apiResponse && waitTime < maxWaitTime) {
      await page.waitForTimeout(500);
      waitTime += 500;
    }

    if (!apiResponse) {
      throw new Error('API response not received within timeout period');
    }

    // Extract items_cnt from the response
    const itemsCount = apiResponse?.data?.session?.items_cnt;
    
    if (itemsCount === undefined) {
      throw new Error('items_cnt not found in API response');
    }

    // Close the page to free up RAM (stops video playback)
    console.log('Closing page to free up resources...');
    await page.close();

    // Return the item count
    res.json({
      sessionId: parseInt(sessionId),
      itemsCount: itemsCount,
      success: true
    });

  } catch (error) {
    console.error('Error:', error.message);
    
    // Make sure to close the page even on error to free up RAM
    if (page) {
      try {
        await page.close();
        console.log('Closed page after error');
      } catch (closeError) {
        // Page might already be closed, ignore the error
        console.log('Page already closed or error closing:', closeError.message);
      }
    }

    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Shopee Live Item Count API',
    usage: 'GET /api/items-count/:sessionId',
    example: '/api/items-count/176778196'
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Example: http://localhost:${PORT}/api/items-count/176778196`);
});

