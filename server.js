const express = require('express');
const { chromium } = require('playwright');

// Prevent stdin from blocking the process (Windows issue)
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', () => {
  // Ignore input but keep stdin open to prevent blocking
});
process.stdin.on('end', () => {
  // Handle stdin end gracefully
});

// Ensure output is flushed immediately
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);
  if (process.stdout.isTTY) {
    process.stdout.write(''); // Force flush
  }
};

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
  let context = null;
  const requestId = `${Date.now()}-${Math.random()}`; // Unique request ID
  
  try {
    // Connect to existing browser via CDP (Chrome DevTools Protocol)
    console.log(`[${requestId}] Connecting to browser via CDP: ${CDP_ENDPOINT}`);
    try {
      browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (error) {
      throw new Error(`Failed to connect to browser via CDP at ${CDP_ENDPOINT}. Make sure your browser is launched with --remote-debugging-port=9222. Error: ${error.message}`);
    }
    
    // Get the default context (or create a new one if needed)
    const contexts = browser.contexts();
    
    if (contexts.length > 0) {
      // Use existing context
      context = contexts[0];
      console.log(`[${requestId}] Using existing browser context`);
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
      console.log(`[${requestId}] Created new browser context`);
    }
    
    // Create a new page for this request (will be closed after use to save RAM)
    page = await context.newPage();
    const pageId = page.url(); // Use URL as unique identifier (will be empty initially, but unique per page)
    console.log(`[${requestId}] Created new page for request`);

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

    // Navigate to the Shopee live URL
    const liveUrl = `https://live.shopee.co.id/share?from=live&session=${sessionId}`;
    console.log(`Navigating to: ${liveUrl}`);
    
    await page.goto(liveUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 80000
    });
    
    // Check if live streaming has ended
    console.log('Checking if live streaming has ended...');
    const pageContent = await page.content();
    if (pageContent.includes('Live Streaming Berakhir')) {
      await page.close();
      return res.status(400).json({
        error: 'Live streaming has ended',
        success: false
      });
    }
    
    // Wait for video element to appear
    console.log('Waiting for video element to appear...');
    try {
      await page.waitForSelector('video', { 
        timeout: 80000,
        state: 'attached'
      });
      console.log('Video element found');
    } catch (error) {
      await page.close();
      throw new Error('Video element not found within timeout period');
    }
    
    // Click video element programmatically
    console.log('Clicking video element...');
    const videoClicked = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.click();
        return true;
      }
      return false;
    });
    
    if (!videoClicked) {
      await page.close();
      throw new Error('Video element not found after waiting');
    }

    // Wait for the API request to complete
    console.log('Waiting for API response...');
    let waitTime = 0;
    const maxWaitTime = 80000;
    
    while (!apiResponse && waitTime < maxWaitTime) {
      await page.waitForTimeout(100);
      waitTime += 100;
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
    // Verify this is still our page before closing
    if (page && !page.isClosed()) {
      console.log(`[${requestId}] Closing page to free up resources...`);
      try {
        await page.close();
      } catch (closeError) {
        console.error(`[${requestId}] Error closing page:`, closeError.message);
      }
    }

    // Return the item count
    res.json({
      sessionId: parseInt(sessionId),
      itemsCount: itemsCount,
      success: true
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error.message);
    
    // Make sure to close the page even on error to free up RAM
    // Only close if it's our page and not already closed
    if (page && !page.isClosed()) {
      try {
        await page.close();
        console.log(`[${requestId}] Closed page after error`);
      } catch (closeError) {
        // Page might already be closed, ignore the error
        console.log(`[${requestId}] Page already closed or error closing:`, closeError.message);
      }
    }

    res.status(500).json({
      error: error.message,
      success: false
    });
  }
});

// API endpoint to get product data
app.get('/api/products/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  let browser = null;
  let page = null;
  let context = null;
  const requestId = `${Date.now()}-${Math.random()}`; // Unique request ID
  
  try {
    // Connect to existing browser via CDP
    console.log(`[${requestId}] Connecting to browser via CDP: ${CDP_ENDPOINT}`);
    try {
      browser = await chromium.connectOverCDP(CDP_ENDPOINT);
    } catch (error) {
      throw new Error(`Failed to connect to browser via CDP at ${CDP_ENDPOINT}. Make sure your browser is launched with --remote-debugging-port=9222. Error: ${error.message}`);
    }
    
    // Get the default context (or create a new one if needed)
    const contexts = browser.contexts();
    
    if (contexts.length > 0) {
      // Use existing context
      context = contexts[0];
      console.log(`[${requestId}] Using existing browser context`);
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
      console.log(`[${requestId}] Created new browser context`);
    }

    // Create a new page for this request
    page = await context.newPage();
    const pageId = page.url(); // Use URL as unique identifier
    console.log(`[${requestId}] Created new page for request`);

    // Helper function to remove Shopee dialog popup by deleting the node
    const closeShopeeDialog = async () => {
      try {
        const dialogRemoved = await page.evaluate(() => {
          const dialog = document.querySelector('.Dialog__Container-sc-1l9g2uc-0.iOfyCd') ||
                        document.querySelector('[class*="Dialog__Container"]');
          if (dialog) {
            dialog.remove(); // Direct removal
            return true;
          }
          return false;
        });
        
        if (dialogRemoved) {
          console.log('Removed Shopee dialog popup');
          return true;
        }
      } catch (e) {
        // Dialog not found or error, continue
      }
      return false;
    };

    // Set up response interceptors
    let joinv2Response = null;
    const joinv2Pattern = new RegExp(`/api/v1/session/${sessionId}/joinv2`);
    
    // Store all items from more_items API calls
    const allItems = new Map(); // Use Map to deduplicate by item_id
    const moreItemsPattern = new RegExp(`/api/v1/session/${sessionId}/more_items`);

    page.on('response', async (response) => {
      const url = response.url();
      
      if (joinv2Pattern.test(url)) {
        try {
          joinv2Response = await response.json();
        } catch (error) {
          console.error('Error parsing joinv2 response:', error);
        }
      }
      
      if (moreItemsPattern.test(url)) {
        try {
          const data = await response.json();
          if (data && data.data && data.data.items) {
            // Add items to map, deduplicating by item_id
            data.data.items.forEach(item => {
              if (item.item_id) {
                if (!allItems.has(item.item_id)) {
                  allItems.set(item.item_id, item);
                }
              } else {
                console.warn('Item missing item_id:', item);
              }
            });
            console.log(`Received ${data.data.items.length} items, total unique: ${allItems.size}`);
          }
        } catch (error) {
          console.error('Error parsing more_items response:', error);
        }
      }
    });

    // Navigate to the Shopee live URL
    const liveUrl = `https://live.shopee.co.id/share?from=live&session=${sessionId}`;
    console.log(`Navigating to: ${liveUrl}`);
    
    await page.goto(liveUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 80000
    });
    
    // Check if live streaming has ended
    console.log('Checking if live streaming has ended...');
    const pageContent = await page.content();
    if (pageContent.includes('Live Streaming Berakhir')) {
      await page.close();
      return res.status(400).json({
        error: 'Live streaming has ended',
        success: false
      });
    }
    
    // Close any popup before waiting for video
    await closeShopeeDialog();
    
    // Wait for video element and click it
    console.log('Waiting for video element to appear...');
    try {
      await page.waitForSelector('video', { 
        timeout: 80000,
        state: 'attached'
      });
      console.log('Video element found');
    } catch (error) {
      await page.close();
      throw new Error('Video element not found within timeout period');
    }
    
    // Close popup again before clicking video
    await closeShopeeDialog();
    
    console.log('Clicking video element...');
    const videoClicked = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.click();
        return true;
      }
      return false;
    });
    
    if (!videoClicked) {
      await page.close();
      throw new Error('Video element not found after waiting');
    }

    // Wait for joinv2 response to get items_cnt
    console.log('Waiting for joinv2 response to get items count...');
    let waitTime = 0;
    const maxWaitTime = 80000;
    
    while (!joinv2Response && waitTime < maxWaitTime) {
      await page.waitForTimeout(100);
      waitTime += 100;
    }

    if (!joinv2Response) {
      await page.close();
      throw new Error('joinv2 API response not received within timeout period');
    }

    const itemsCount = joinv2Response?.data?.session?.items_cnt;
    
    if (itemsCount === undefined) {
      await page.close();
      throw new Error('items_cnt not found in API response');
    }

    console.log(`Expected items count: ${itemsCount}`);
    
    // Wait a bit for first more_items API call to happen automatically
    console.log('Waiting for initial product data...');
    await page.waitForTimeout(2000);
    
    // Scroll and collect items until we have all items
    console.log('Scrolling to collect all items...');
    const scrollContainer = '.ProductList__StyledList-zzolnk-4.eUSJvS';
    let previousItemCount = 0;
    let noNewItemsCount = 0;
    const maxNoNewItems = 3;
    const scrollStartTime = Date.now();
    const maxScrollTime = 80000; // 80 seconds max for scrolling
    
    while (allItems.size < itemsCount) {
      // Check overall timeout
      if (Date.now() - scrollStartTime > maxScrollTime) {
        console.log('Reached maximum scroll time (80s), stopping...');
        break;
      }
      
      // Close Shopee dialog popup if it appears
      await closeShopeeDialog();
      
      // Scroll down in the container programmatically
      await page.evaluate((selector) => {
        const container = document.querySelector(selector) || 
                         document.querySelector('[class*="ProductList"]');
        if (container) {
          container.scrollTop += 500;
        } else {
          // Fallback: scroll the page
          window.scrollBy(0, 500);
        }
      }, scrollContainer);
      
      await page.waitForTimeout(500);
      
      // Check if we got new items
      if (allItems.size === previousItemCount) {
        noNewItemsCount++;
        if (noNewItemsCount >= maxNoNewItems) {
          console.log('No new items after scrolling, stopping...');
          break;
        }
      } else {
        noNewItemsCount = 0;
      }
      
      previousItemCount = allItems.size;
      console.log(`Collected ${allItems.size} / ${itemsCount} items`);
      
      // Safety timeout - don't scroll forever
      if (allItems.size >= itemsCount) {
        console.log('All items collected!');
        break;
      }
      
      // Additional safety: if we've been scrolling for too long
      if (allItems.size > 0 && allItems.size < itemsCount) {
        // Check if we're at the bottom
        const isAtBottom = await page.evaluate((selector) => {
          const container = document.querySelector(selector) || 
                           document.querySelector('[class*="ProductList"]');
          if (container) {
            return container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
          }
          return window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
        }, scrollContainer);
        
        if (isAtBottom && noNewItemsCount >= 2) {
          console.log('Reached bottom and no new items, stopping...');
          break;
        }
      }
    }

    // Convert Map to Array and extract item_id, shop_id, and stock
    const allProducts = Array.from(allItems.values());
    const products = allProducts.map(item => ({
      item_id: item.item_id,
      shop_id: item.shop_id,
      stock: item.display_total_stock !== undefined ? item.display_total_stock : (item.sp_total_stock !== undefined ? item.sp_total_stock : null)
    }));
    
    console.log(`Final item count: ${products.length} (expected: ${itemsCount})`);

    // Close the page to free up RAM
    // Verify this is still our page before closing
    if (page && !page.isClosed()) {
      console.log(`[${requestId}] Closing page to free up resources...`);
      try {
        await page.close();
      } catch (closeError) {
        console.error(`[${requestId}] Error closing page:`, closeError.message);
      }
    }

    // Extract session metadata from joinv2 response
    const sessionData = joinv2Response?.data?.session || {};
    
    // Return the products with metadata
    res.json({
      success: true,
      sessionId: parseInt(sessionId),
      metadata: {
        expectedItemsCount: itemsCount,
        productsFound: products.length,
        collectionComplete: products.length >= itemsCount,
        session: {
          session_id: sessionData.session_id,
          username: sessionData.username,
          nickname: sessionData.nickname,
          title: sessionData.title,
          shop_id: sessionData.shop_id,
          status: sessionData.status,
          start_time: sessionData.start_time,
          end_time: sessionData.end_time,
          member_cnt: sessionData.member_cnt,
          like_cnt: sessionData.like_cnt,
          viewer_count: sessionData.viewer_count
        }
      },
      products: products
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error.message);
    
    // Only close if it's our page and not already closed
    if (page && !page.isClosed()) {
      try {
        await page.close();
        console.log(`[${requestId}] Closed page after error`);
      } catch (closeError) {
        console.log(`[${requestId}] Page already closed or error closing:`, closeError.message);
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`Server is accessible from: http://YOUR_IP:${PORT}`);
  console.log(`Example: http://YOUR_IP:${PORT}/api/items-count/176778196`);
  console.log(`\nMake sure to open port ${PORT} in Windows Firewall!`);
});

