// middlewares/validateRegister.ts
import { body } from "express-validator";
export const validateRegister = [
    body("full_name").notEmpty().withMessage("Full name is required"),
    body("phone_number")
        .notEmpty()
        .withMessage("Phone number is required")
        .isMobilePhone("vi-VN")
        .withMessage("Invalid Vietnamese phone number"),
    body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email"),
    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
];
export const validateLogin = [
    body("email")
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email"),
    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .isLength({ min: 6 })
        .withMessage("Password must be at least 6 characters"),
];
