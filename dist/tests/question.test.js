import { QuestionController } from "../controllers/questionController"; // ✅ dùng export thường
import { prisma } from "../__mocks__/prisma";
import { Readable } from "stream";
// Mock fs.mkdir nếu controller có dùng mkdir
jest.mock("fs", () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined),
    },
}));
// Mock prisma client
jest.mock("@prisma/client", () => {
    const mPrisma = {
        part: { findUnique: jest.fn() },
        exam: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    };
    return {
        PrismaClient: jest.fn(() => mPrisma), // 👈 đúng kiểu constructor
    };
});
// File giả để test upload
const mockFile = {
    fieldname: "file",
    originalname: "test.jpg",
    encoding: "7bit",
    mimetype: "image/jpeg",
    size: 1234,
    destination: "/uploads",
    filename: "test_image.jpg",
    path: "/uploads/test_image.jpg",
    buffer: Buffer.from("mock file content"),
    stream: Readable.from(["mock file content"]), // 👈 thêm dòng này
};
describe("create-question", () => {
    let req;
    let res;
    beforeEach(() => {
        req = {
            query: {
                part_id: "1",
                exam_id: "1",
            },
            body: {
                description: "Sample Group",
                type_group: "1",
                title: "Sample Title",
                questions: [
                    {
                        title: "Sample Question 1",
                        description: "Description of question 1",
                        option: ["Option 1", "Option 2"],
                        correct_option: 0,
                        score: 5,
                        elements: [],
                    },
                ],
            },
            files: [mockFile],
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });
    it("should return 400 if exam_id or part_id is missing", async () => {
        delete req.query?.exam_id;
        await QuestionController.createQuestion(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Exam or part is required!",
        });
    });
    it("should create question group and questions successfully", async () => {
        prisma.part.findUnique.mockResolvedValue("Part 1");
        prisma.exam.findUnique.mockResolvedValue("Exam 1");
        prisma.$transaction.mockImplementation(async (callback) => {
            return await callback({
                questionGroup: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 1 }),
                },
                element: {
                    createMany: jest.fn().mockResolvedValue(true),
                },
                question: {
                    findFirst: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 1, global_order: 1 }),
                },
            });
        });
        await QuestionController.createQuestion(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Questions created successfully.",
            newGroup: expect.anything(),
        });
    });
    it("should return error if an exception is thrown", async () => {
        prisma.part.findUnique.mockResolvedValue("Part 1");
        prisma.exam.findUnique.mockResolvedValue("Exam 1");
        prisma.$transaction.mockRejectedValue(new Error("Something went wrong"));
        await QuestionController.createQuestion(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "Something went wrong" });
    });
});
