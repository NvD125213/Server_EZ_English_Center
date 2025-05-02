import { Router } from "express";
import { AuthController } from "../controllers/authController";
import { validateRegister, validateLogin } from "../validates/authValidate";
import { handleValidation } from "../middlewares/handleValidation";
import passport from "passport";
import "../config/passport";
import { ensureAuthenticated } from "../middlewares/auth";
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
router.post("/resendVerify-otp", AuthController.resendVerifyOtp);
router.get("/current-user", ensureAuthenticated, AuthController.getCurrentUser);

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

router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
});

export default router;
