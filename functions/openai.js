/*
  Cloudflare Pages Function — OpenAI API Proxy
  ---------------------------------------------
  This file lives in the /functions folder so Cloudflare Pages treats it
  as a serverless function, NOT a static file.

  It will be available at: https://your-site.pages.dev/openai

  To add your API key:
    1. Go to your Cloudflare Pages project dashboard
    2. Click Settings → Environment variables
    3. Add a variable named OPENAI_API_KEY with your key as the value
    4. Save and redeploy

  The key is stored securely on Cloudflare's servers and is never
  visible to the browser.
*/

export async function onRequestPost(context) {
  /* CORS headers so the browser can call this function */
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  /* Get the request body sent from the front-end */
  const body = await context.request.json();

  /* Forward the request to OpenAI, injecting the secret API key */
  const openaiResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        /* context.env holds the environment variables set in the Pages dashboard */
        Authorization: `Bearer ${context.env.projectroutine}`,
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
}

/* Handle CORS preflight requests */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
