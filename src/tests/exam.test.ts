import { Request, Response } from "express";
import { ExamController } from "../controllers/examControllers";
import { prisma } from "../libs/prisma"; // Đảm bảo import đúng cái đang mock

jest.mock("../libs/prisma", () => ({
  prisma: {
    exam: {
      findMany: jest.fn(),
    },
  },
}));

describe("getExamBySubject", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = { params: {} };
    res = { status: statusMock } as unknown as Response;
  });

  it("should return 400 if subject_id is invalid", async () => {
    req.params = { subject_id: "abc" };

    await ExamController.getExamBySubject(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid subject ID" });
  });

  it("should return 200 and exams if successful", async () => {
    req.params = { subject_id: "1" };
    const mockExams = [
      { id: 1, name: "Exam 1" },
      { id: 2, name: "Exam 2" },
    ];
    (prisma.exam.findMany as jest.Mock).mockResolvedValue(mockExams);

    await ExamController.getExamBySubject(req as Request, res as Response);

    expect(prisma.exam.findMany).toHaveBeenCalledWith({
      where: { subject_id: 1 },
      orderBy: { id: "asc" },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(mockExams);
  });

  it("should return 500 if there is an error", async () => {
    req.params = { subject_id: "2" };
    (prisma.exam.findMany as jest.Mock).mockRejectedValue(
      new Error("DB error")
    );

    await ExamController.getExamBySubject(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});
