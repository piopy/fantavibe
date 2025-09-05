import fetch from "node-fetch";

export async function handler(event, context) {
  const url = process.env.REACT_APP_DIRECT_FILE_URL || "";
  
  console.log('Fetching from URL:', url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "FantaVibe-App",
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
    const buffer = await response.arrayBuffer();
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
