// .netlify/functions/get-file-info.js

/**
 * Netlify Function to get file information (ETag, Last-Modified, Content-Length)
 * This replaces the client-side getFileInfo method to avoid CORS issues
 */
export async function handler(event, context) {
  const url = process.env.REACT_APP_DIRECT_FILE_URL || "";
  
  // Handle preflight OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, User-Agent',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400', // 24 hours
        'Vary': 'Origin'
      },
      body: '',
    };
  }
  
  console.log('Getting file info from URL:', url);

  if (!url) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary": "Origin"
      },
      body: JSON.stringify({ 
        error: "DIRECT_FILE_URL environment variable not configured" 
      }),
    };
  }

  try {
    let response;
    
    // Use built-in fetch if available (Node.js 18+)
    if (typeof fetch !== 'undefined') {
      // Make HEAD request to get only headers (more efficient than GET)
      response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'FantaVibe-App'
        }
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
          method: 'HEAD', // HEAD request for headers only
          headers: {
            'User-Agent': 'FantaVibe-App'
          }
        }, (res) => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: {
              get: (name) => res.headers[name.toLowerCase()],
              entries: () => Object.entries(res.headers)
            }
          });
        });
        
        req.on('error', reject);
        req.end();
      });
    }

    console.log('File info response status:', response.status);

    if (!response.ok) {
      throw new Error(`File check error: ${response.status} ${response.statusText || 'Request failed'}`);
    }

    // Extract file information from headers
    const fileInfo = {
      etag: response.headers.get('etag') || response.headers.get('ETag'),
      lastModified: response.headers.get('last-modified') || response.headers.get('Last-Modified'),
      contentLength: response.headers.get('content-length') || response.headers.get('Content-Length'),
      timestamp: new Date().toISOString()
    };

    console.log('File info extracted:', fileInfo);

    // Return file info with proper CORS headers
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "false",
        "Vary": "Origin"
      },
      body: JSON.stringify(fileInfo)
    };

  } catch (error) {
    console.error('Get file info error:', error);
    
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Vary": "Origin"
      },
      body: JSON.stringify({ 
        error: error.message,
        url: url
      })
    };
  }
}
