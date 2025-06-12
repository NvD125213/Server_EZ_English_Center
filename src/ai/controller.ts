import { Request, Response } from "express";
import OpenAI from "openai";
import fs from "fs";
import dotenv from "dotenv";
import { io } from "../index.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Hàm tính độ tương đồng cosine
function cosineSimilarity(vecA: number[], vecB: number[]) {
  const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// // Hàm random lời chào
// function getRandomGreeting() {
//   const greetings = [
//     "Xin chào! Tôi là trợ lý ảo của Trung tâm Tiếng Anh EZ, tôi có thể giúp gì cho bạn hôm nay?",
//     "Chào bạn! Tôi luôn sẵn sàng hỗ trợ các câu hỏi về khóa học và thông tin trung tâm nhé!",
//     "Xin chào! Tôi ở đây để giúp bạn trả lời các câu hỏi liên quan đến trung tâm. Bạn có thắc mắc nào không ạ?",
//   ];
//   return greetings[Math.floor(Math.random() * greetings.length)];
// }

export async function aiAgentController(req: Request, res: Response) {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Thiếu thông tin",
        message: "Vui lòng cung cấp câu hỏi",
      });
    }

    // Generate embedding for the user's question
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const questionEmbedding = response.data[0].embedding;

    // Read the training data with embeddings
    const data = JSON.parse(fs.readFileSync("./ai/data-training.json", "utf8"));

    // Find the most similar question using cosine similarity
    let maxSimilarity = -1;
    let bestMatch = null;

    for (const faq of data) {
      if (!faq.embedding) continue;

      const similarity = cosineSimilarity(questionEmbedding, faq.embedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = faq;
      }
    }

    let answer: string;

    if (bestMatch && maxSimilarity > 0.7) {
      answer = bestMatch.Answer;
    } else {
      // Không tìm thấy, gọi ChatCompletion
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý ảo thân thiện hỗ trợ trung tâm tiếng Anh. Nếu bạn không biết câu trả lời chính xác, hãy lịch sự đề nghị liên hệ trung tâm.",
          },
          { role: "user", content: question },
        ],
      });

      answer =
        chatResponse.choices[0].message?.content ||
        "Xin lỗi, tôi chưa thể trả lời câu hỏi này. Bạn có thể thử hỏi lại hoặc liên hệ trung tâm.";
    }

    // Gửi câu trả lời qua socket.io
    io.emit("chat-response", {
      answer,
      question,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      answer,
      similarity: maxSimilarity,
      matchedQuestion: bestMatch?.Question || null,
    });
  } catch (error) {
    console.error("Lỗi hệ thống:", error);
    return res.status(500).json({
      error: "Lỗi hệ thống",
      message: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau.",
    });
  }
}
