import fs from "fs";
import dotenv from "dotenv";
import OpenAI from "openai";
dotenv.config();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
async function createEmbeddings() {
    const rawData = fs.readFileSync("C:/CenterManagement/Server/ai/data-training.json", "utf8");
    const faqs = JSON.parse(rawData);
    for (const faq of faqs) {
        // Tạo embedding cho câu hỏi
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: faq.Question,
        });
        // Gán embedding vào faq
        faq["embedding"] = response.data[0].embedding;
    }
    fs.writeFileSync("./ai/data-training.json", JSON.stringify(faqs, null, 2));
    console.log("Tạo embeddings cho FAQ xong");
}
createEmbeddings();
async function getEmbeddingForText(text) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}
async function addNewQuestion(question, answer) {
    const data = JSON.parse(fs.readFileSync("./ai/data-training.json", "utf8"));
    const embedding = await getEmbeddingForText(question);
    const newEntry = {
        Question: question,
        Answer: answer,
        embedding,
    };
    data.push(newEntry);
    fs.writeFileSync("./ai/data-training.json", JSON.stringify(data, null, 2), "utf8");
    console.log(`Thêm câu hỏi mới: "${question}"`);
}
// Thêm câu hỏi mới
addNewQuestion("Xin chào", "Xin chào! Tôi là trợ lý ảo của Trung tâm Tiếng Anh EZ, tôi có thể giúp gì cho bạn?");
