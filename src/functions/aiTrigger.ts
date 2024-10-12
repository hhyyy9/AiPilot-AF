import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import OpenAI from 'openai';


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

interface RequestBody {
    jobPosition: string;
    prompt: string;
    language: string;
    resumeContent: string;
  }

async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const body = await request.json() as RequestBody;
    const { jobPosition, prompt, language, resumeContent } = body;

    try {
        const messages = [
            { role: "system", content: `You are a job candidate in an interview. Answer questions in ${language} based on the provided resume. Your responses should be concise, highlighting only the most relevant points. Be professional and specific, focusing on key achievements and skills.` },
            { role: "user", content: `Job Position: ${jobPosition}\n\nResume content:\n\n${resumeContent}\n\nRemember this information for your responses.` },
            { role: "assistant", content: "Understood. I'm ready to provide concise, relevant answers based on the resume." },
            { role: "user", content: `Interviewer's question: ${prompt}\nProvide a brief, focused answer highlighting key points.` }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages.map(m => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content
            })),
            max_tokens: 300,
        });

        return { body: response.choices[0].message.content };
    } catch (error) {
        context.error('处理请求时发生错误', error);
        return { status: 500, body: error.message };
    }
}

app.http('httpTrigger', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: httpTrigger
});
