import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import session from "express-session";
const prisma = new PrismaClient();
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    done(null, user);
});
const app = express();
import express from "express";
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/api/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails?.[0]?.value;
        const fullName = profile.displayName;
        if (!email) {
            return done(new Error("Email not found"), undefined);
        }
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id },
        });
        if (!user) {
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const email = profile.emails?.[0]?.value;
            const newUser = await prisma.user.create({
                data: {
                    full_name: fullName,
                    email: email,
                    password: randomPassword,
                    phone_number: "Not update",
                    role: 5,
                },
            });
            return done(null, newUser);
        }
        else {
            return done(null, user);
        }
    }
    catch (err) {
        return done(err, undefined);
    }
}));
// Lưu user vào session
passport.serializeUser((user, done) => {
    done(null, user.id); // chỉ nên lưu ID
});
// Lấy user từ session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: id,
            },
        });
        done(null, user);
    }
    catch (err) {
        done(err, null);
    }
});
