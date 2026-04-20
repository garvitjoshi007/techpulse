export interface Env {
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  TO_EMAIL: string;
  FROM_EMAIL: string;
}

interface HNStory {
  title: string;
  url?: string;
  points: number;
}

async function fetchHNStories(): Promise<HNStory[]> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=50"
  );
  const data = await res.json<{ hits: HNStory[] }>();
  return data.hits.filter((s) => s.url && s.title);
}

async function generateNewsletter(apiKey: string, stories: HNStory[]): Promise<string> {
  const storiesList = stories
    .map((s, i) => `${i + 1}. [${s.title}](${s.url}) — score: ${s.points}`)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: `Today is ${new Date().toDateString()}. Here are the top 50 stories on Hacker News right now:

${storiesList}

You are writing a daily newsletter for a software engineer who cares about: AI/LLM news, new dev tools, open-source releases, startups, security vulnerabilities, programming languages, and cloud/infra. They do NOT care about: politics, sports, finance (unless it's a big tech funding), or general business news.

Pick the 10 best stories that match their interests. For each, write a sharp 2-sentence summary and one "why it matters" sentence. Use the real URL from the list as the link.

Output ONLY clean HTML (no <html>/<head>/<body> tags). Use exactly this structure:

<h2 style="font-family:sans-serif;color:#111;margin-bottom:4px;">⚡ Tech Briefing — ${new Date().toDateString()}</h2>
<p style="font-family:sans-serif;color:#888;font-size:13px;margin-top:0;">Your no-fluff daily digest — curated from Hacker News.</p>
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">

For each of the 10 stories, output exactly:
<div style="margin-bottom:28px;font-family:sans-serif;">
  <h3 style="margin:0 0 6px;font-size:16px;"><a href="REAL_URL" style="color:#1a0dab;text-decoration:none;">HEADLINE</a></h3>
  <p style="margin:0 0 6px;color:#333;font-size:14px;line-height:1.5;">SUMMARY (2 sentences)</p>
  <p style="margin:0;font-size:13px;color:#666;"><strong>Why it matters:</strong> ONE_SENTENCE</p>
</div>

After all 10 stories add:
<hr style="border:none;border-top:1px solid #eee;margin:16px 0;">
<p style="font-family:sans-serif;color:#aaa;font-size:12px;text-align:center;">Delivered daily at 8 AM · Powered by Claude + Hacker News</p>

Rules: Be direct. No filler phrases. Do not add any text outside the HTML.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json<{ content: Array<{ type: string; text: string }> }>();
  return data.content[0].text;
}

async function sendEmail(
  resendApiKey: string,
  to: string,
  from: string,
  html: string,
  date: string
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `⚡ Tech Briefing — ${date}`,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend API error: ${response.status} ${await response.text()}`);
  }
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const date = new Date().toDateString();
        console.log(`[newsletter] Fetching HN stories for ${date}`);
        const stories = await fetchHNStories();
        console.log(`[newsletter] Fetched ${stories.length} stories, generating newsletter...`);
        const html = await generateNewsletter(env.ANTHROPIC_API_KEY, stories);
        console.log("[newsletter] Newsletter generated, sending email...");
        await sendEmail(env.RESEND_API_KEY, env.TO_EMAIL, env.FROM_EMAIL, html, date);
        console.log("[newsletter] Done");
      })()
    );
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (new URL(request.url).pathname === "/trigger") {
      ctx.waitUntil(
        (async () => {
          const date = new Date().toDateString();
          const stories = await fetchHNStories();
          const html = await generateNewsletter(env.ANTHROPIC_API_KEY, stories);
          await sendEmail(env.RESEND_API_KEY, env.TO_EMAIL, env.FROM_EMAIL, html, date);
        })()
      );
      return new Response("Newsletter triggered", { status: 202 });
    }
    return new Response("Daily Newsletter Worker", { status: 200 });
  },
};
