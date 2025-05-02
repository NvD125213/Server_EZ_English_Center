import { body, query } from "express-validator";
import { Option } from "../Types/question"; // Import Option enum nếu cần

export const createQuestionValidator = [
  // Validate query parameters
  query("exam_id").isInt().withMessage("Invalid exam_id."),
  query("part_id").isInt().withMessage("Invalid part_id."),

  // Validate body fields
  body("title").notEmpty().withMessage("Title is required."),
  body("type_group").notEmpty().withMessage("Type group is required."),
  body("description").optional(),
  body("pathDir").notEmpty().withMessage("Path directory is required."),

  // Validate questions array
  body().custom((value, { req }) => {
    // Kiểm tra xem có ít nhất một câu hỏi không
    const hasQuestions = Object.keys(req.body).some((key) =>
      key.startsWith("questions[")
    );
    if (!hasQuestions) {
      throw new Error("At least one question is required.");
    }
    return true;
  }),

  // Validate each question
  body().custom((value, { req }) => {
    const questionKeys = Object.keys(req.body).filter((key) =>
      key.startsWith("questions[")
    );
    const questionIndices = new Set(
      questionKeys
        .map((key) => key.match(/questions\[(\d+)\]/)?.[1])
        .filter(Boolean)
    );

    for (const index of questionIndices) {
      // Kiểm tra các trường bắt buộc của câu hỏi
      if (!req.body[`questions[${index}][title]`]) {
        throw new Error(`Question ${index} must have a title.`);
      }

      // Kiểm tra options
      const optionKeys = Object.keys(req.body).filter((key) =>
        key.startsWith(`questions[${index}][option][`)
      );
      if (optionKeys.length === 0) {
        throw new Error(`Question ${index} must have at least one option.`);
      }

      // Kiểm tra correct_option
      if (!req.body[`questions[${index}][correct_option]`]) {
        throw new Error(`Question ${index} must have a correct option.`);
      }
      const correctOption = req.body[`questions[${index}][correct_option]`];
      if (!["A", "B", "C", "D"].includes(correctOption)) {
        throw new Error(
          `Question ${index} correct_option must be A, B, C, or D.`
        );
      }

      // Kiểm tra score
      if (!req.body[`questions[${index}][score]`]) {
        throw new Error(`Question ${index} must have a score.`);
      }
      const score = Number(req.body[`questions[${index}][score]`]);
      if (isNaN(score) || score <= 0) {
        throw new Error(`Question ${index} score must be a positive number.`);
      }
    }
    return true;
  }),

  body("questions.*.elements")
    .optional()
    .isArray()
    .withMessage("Elements should be an array."),
  body("questions.*.elements.*.type")
    .optional()
    .isIn(["audio", "image"])
    .withMessage("Invalid element type."),
  body("questions.*.elements.*.url")
    .optional()
    .isString()
    .withMessage("Element URL should be a string."),
  body("elements")
    .optional()
    .isArray()
    .withMessage("Elements should be an array."),
  body("elements.*.type")
    .optional()
    .isIn(["audio", "image"])
    .withMessage("Invalid element type."),
  body("elements.*.url")
    .optional()
    .isString()
    .withMessage("Element URL should be a string."),
];
