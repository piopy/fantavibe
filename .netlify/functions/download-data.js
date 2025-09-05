export async function handler(event, context) {
  const url = process.env.REACT_APP_DIRECT_FILE_URL || "";
  
  console.log('Fetching from URL:', url);

  if (!url) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: "DIRECT_FILE_URL environment variable not configured" 
      }),
    };
  }

  try {
    // Use built-in fetch if available (Node.js 18+)
    let response;
    
    if (typeof fetch !== 'undefined') {
      // Use built-in fetch
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "FantaVibe-App",
        },
      });
    } else {
      // Fallback to https module for older Node.js versions
      const https = await import('https');
      const { URL } = await import('url');
      
      const urlObj = new URL(url);
      
      response = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'FantaVibe-App'
          }
        }, (res) => {
          let data = [];
          
          res.on('data', chunk => data.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(data);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              headers: {
                get: (name) => res.headers[name.toLowerCase()],
                entries: () => Object.entries(res.headers)
              },
              buffer: () => Promise.resolve(buffer)
            });
          });
        });
        
        req.on('error', reject);
        req.end();
      });
    }

    console.log('Response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`);
    }

    // Check content type
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    // If it's HTML, we have the wrong URL
    if (contentType && contentType.includes('text/html')) {
      console.error('ERROR: Received HTML instead of binary file. Check your DIRECT_FILE_URL.');
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ 
          error: "Received HTML instead of binary file. URL may be incorrect.",
          url: url,
          contentType: contentType
        }),
      };
    }

    // Get the binary data as buffer
    let buffer;
    if (response.buffer) {
      buffer = await response.buffer();
    } else {
      // For built-in fetch
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
    
    console.log('Downloaded buffer size:', buffer.length, 'bytes');

    // Forward important headers
    const headers = {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Access-Control-Allow-Origin": "*",
    };

    // Forward cache-related headers if they exist
    if (response.headers.get('etag')) {
      headers['etag'] = response.headers.get('etag');
    }
    if (response.headers.get('last-modified')) {
      headers['last-modified'] = response.headers.get('last-modified');
    }
    if (response.headers.get('content-length')) {
      headers['content-length'] = response.headers.get('content-length');
    }

    return {
      statusCode: 200,
      headers,
      body: buffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error('Download error:', error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        error: error.message,
        url: url
      }),
    };
  }
}
