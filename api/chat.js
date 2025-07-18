
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const assistantIDs = {
  ashley: "asst_k3dHtKqcdXhc07VgEVpJwkfd",
  "Viral S.F. Video Scripts": "asst_5KL56DaiFpm2GT6Ayp6vqLy5",
  "Your Personal Meal Planner": "asst_YNInGDhCWN2F4KZvl29VgApI"
};

let scottThreadId = null;
let routedThreads = {};
let routedAlready = false;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { message } = req.body;

    if (!scottThreadId) {
      const thread = await openai.beta.threads.create();
      scottThreadId = thread.id;
      routedAlready = false;
    }

    await openai.beta.threads.messages.create(scottThreadId, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.create(scottThreadId, {
      assistant_id: assistantIDs.ashley,
    });

    let runStatus;
    do {
      await new Promise((res) => setTimeout(res, 1500));
      runStatus = await openai.beta.threads.runs.retrieve(scottThreadId, run.id);
    } while (runStatus.status !== "completed");

    const messages = await openai.beta.threads.messages.list(scottThreadId);
    const ashleyMessage = messages.data[0].content[0].text.value;

    let finalReply = ashleyMessage;

    if (!routedAlready) {
      let routedAssistant = null;
      if (/video|script|reels|tiktok/i.test(message)) {
        routedAssistant = assistantIDs["Viral S.F. Video Scripts"];
      } else if (/food|calories|meal|macros|nutrition|fat loss/i.test(message)) {
        routedAssistant = assistantIDs["Your Personal Meal Planner"];
      }

      if (routedAssistant) {
        routedAlready = true;

        if (!routedThreads[routedAssistant]) {
          const newThread = await openai.beta.threads.create();
          routedThreads[routedAssistant] = newThread.id;
        }

        await openai.beta.threads.messages.create(routedThreads[routedAssistant], {
          role: "user",
          content: message,
        });

        const routedRun = await openai.beta.threads.runs.create(routedThreads[routedAssistant], {
          assistant_id: routedAssistant,
        });

        let routedStatus;
        do {
          await new Promise((res) => setTimeout(res, 1500));
          routedStatus = await openai.beta.threads.runs.retrieve(routedThreads[routedAssistant], routedRun.id);
        } while (routedStatus.status !== "completed");

        const routedMessages = await openai.beta.threads.messages.list(routedThreads[routedAssistant]);
        const routedReply = routedMessages.data[0].content[0].text.value;

        finalReply = `${ashleyMessage}

➡️ ${routedReply}`;
      }
    }

    res.status(200).json({ response: finalReply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
