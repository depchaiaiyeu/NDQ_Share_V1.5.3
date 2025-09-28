import axios from "axios";
import { getGlobalPrefix } from "../../service.js";
import { getContent } from "../../../utils/format-util.js";
import { sendMessageComplete, sendMessageFailed, sendMessageQuery, sendMessageStateQuote } from "../../chat-zalo/chat-style/chat-style.js";

const OPENAI_API_KEY = "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";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function callGPTAPI(question) {
  try {
    const response = await axios.post(OPENAI_URL, {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: question
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    return data.choices[0].message.content;
  } catch (error) {
    console.error("Lỗi khi gọi API GPT:", error.response?.data || error.message);
    return null;
  }
}

export async function askGPTCommand(api, message, aliasCommand) {
  const content = getContent(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const question = content.replace(`${prefix}${aliasCommand}`, "").trim();
  
  if (question === "") {
    await sendMessageQuery(api, message, "Vui lòng nhập câu hỏi cần giải đáp!");
    return;
  }

  try {
    const replyText = await callGPTAPI(question);
    if (!replyText) {
      throw new Error("Không nhận được phản hồi từ API");
    }
    
    await sendMessageStateQuote(api, message, replyText, true, 1800000, false);
  } catch (error) {
    console.error("Lỗi khi xử lý yêu cầu GPT:", error);
    await sendMessageFailed(api, message, "Xin lỗi, có lỗi xảy ra khi xử lý yêu cầu của bạn.");
  }
}
