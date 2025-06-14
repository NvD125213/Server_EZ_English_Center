import { Router } from "express";
import { AuthController } from "../controllers/authController.js";
import { validateRegister, validateLogin } from "../validates/authValidate.js";
import { handleValidation } from "../middlewares/handleValidation.js";
import passport from "passport";
import "../config/passport.js";
import { ensureAuthenticated } from "../middlewares/auth.js";
const router = Router();

router.post(
  "/register",
  validateRegister,
  handleValidation,
  AuthController.register
);

router.post("/login", validateLogin, handleValidation, AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/verify-otp", AuthController.verifyOtp);
router.get("/current-user", ensureAuthenticated, AuthController.getCurrentUser);
router.post("/logout", ensureAuthenticated, AuthController.logout);

router.post("/resendVerify-otp", AuthController.resendVerifyOtp);

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: true,
  }),
  (req, res) => {
    res.redirect("/");
  }
);
router.post("/google", AuthController.GoogleSignInFirebase);

export default router;
