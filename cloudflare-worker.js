/* 
  Cloudflare Worker — OpenAI API Proxy
  ------------------------------------
  Deploy this file as a Cloudflare Worker.
  Store your OpenAI API key as a Worker secret named OPENAI_API_KEY:
    wrangler secret put OPENAI_API_KEY
  
  This worker receives requests from the front-end, adds the secret API key,
  and forwards them to OpenAI — so the key is never exposed in the browser.
*/

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    /* Route /openai POST requests to the OpenAI proxy logic.
       All other requests are served as static assets by Cloudflare. */
    if (url.pathname !== "/openai") {
      return env.ASSETS.fetch(request);
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    /* Handle CORS preflight requests */
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    /* Only allow POST requests to this route */
    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders,
      });
    }

    /* Get the request body sent from the front-end */
    const body = await request.json();

    /* Forward the request to OpenAI, adding the secret API key */
    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          /* The API key is stored as a Worker secret, never visible to the browser */
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    /* Read the response from OpenAI */
    const data = await openaiResponse.json();

    /* Send the response back to the front-end */
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  },
};
