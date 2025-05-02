"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubjectController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.SubjectController = {
    get: async (req, res) => {
        // logic here
    },
    getByID: async (req, res) => {
        // logic here
    },
    create: async (req, res) => {
        try {
            const { name } = req.body;
            if (!name) {
                return res.status(422).json({ error: "Tên là bắt buộc" });
            }
            const subject = await prisma.subject.create({
                data: {
                    name,
                },
            });
            return res.status(201).json(subject);
        }
        catch (err) {
            return res.status(500).json({ error: err });
        }
    },
    update: async (req, res) => { },
    delete: async (req, res) => { },
};
