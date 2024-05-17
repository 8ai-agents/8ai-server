import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function sendMessageSlack(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const name = request.query.get('name') || await request.text() || 'world';
    const data = req.body;

    if (data.challenge) {
        return res.status(200).send(data.challenge);
    }

    if (data.event) {
        const event = data.event;
        if (event.type === 'message' && !event.subtype) {
            const channelId = event.channel;
            const userId = event.user;
            const text = event.text;

            try {
                await client.chat.postMessage({
                    channel: channelId,
                    text: `Hello <@${userId}>! You said: ${text}`,
                });
            } catch (error) {
                console.error(`Error posting message: ${error.message}`);
            }
        }
    }

    return res.status(200).send();
});


    return { body: `Hello, ${name}!` };
};

app.http("sendMessageSlack", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "chat/slack",
  handler: sendMessageSlack,
});
