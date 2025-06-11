import { PrismaClient, TypeElement } from "@prisma/client";
import path from "path";
import { promises as fs } from "fs";
const prisma = new PrismaClient();
export const QuestionController = {
    getAllQuestionOnExam: async (req, res) => {
        const { exam_id } = req.params;
        if (!exam_id) {
            return res.status(400).json({ error: "Exam ID is required!" });
        }
        try {
            // Get all question groups for the exam
            const questionGroups = await prisma.questionGroup.findMany({
                where: {
                    exam_id: Number(exam_id),
                    deleted_at: null,
                },
                include: {
                    questions: {
                        where: {
                            deleted_at: null,
                        },
                        include: {
                            elements: true,
                        },
                        orderBy: {
                            global_order: "asc",
                        },
                    },
                    elements: true,
                    part: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: {
                    part_id: "asc",
                },
            });
            // Group questions by part
            const questionsByPart = questionGroups.reduce((acc, group) => {
                const partIndex = acc.findIndex((p) => p.part === group.part.name);
                if (partIndex === -1) {
                    // Create new part entry
                    acc.push({
                        part: group.part.name,
                        data: [
                            {
                                id: group.id,
                                type_group: group.type_group,
                                part_id: group.part_id,
                                order: group.order,
                                title: group.title,
                                description: group.description,
                                create_at: group.create_at,
                                update_at: group.update_at,
                                deleted_at: group.deleted_at,
                                exam_id: group.exam_id,
                                questions: group.questions,
                                elements: group.elements,
                            },
                        ],
                        total: group.questions.length,
                        page: 1,
                        limit: 10,
                        totalPages: Math.ceil(group.questions.length / 10),
                    });
                }
                else {
                    // Merge with existing part
                    const existingPart = acc[partIndex];
                    existingPart.data.push({
                        id: group.id,
                        type_group: group.type_group,
                        part_id: group.part_id,
                        order: group.order,
                        title: group.title,
                        description: group.description,
                        create_at: group.create_at,
                        update_at: group.update_at,
                        deleted_at: group.deleted_at,
                        exam_id: group.exam_id,
                        questions: group.questions,
                        elements: group.elements,
                    });
                    // Update totals
                    existingPart.total += group.questions.length;
                    existingPart.totalPages = Math.ceil(existingPart.total / 10);
                }
                return acc;
            }, []);
            // Sort questions within each part by global_order
            questionsByPart.forEach((part) => {
                // Combine all questions from all groups in this part
                const allQuestions = part.data.reduce((acc, group) => {
                    return [...acc, ...group.questions];
                }, []);
                // Sort all questions by global_order
                allQuestions.sort((a, b) => a.global_order - b.global_order);
                // Update the data structure to have a single group with all questions
                part.data = [
                    {
                        ...part.data[0],
                        questions: allQuestions,
                        // Combine all elements from all groups
                        elements: part.data.reduce((acc, group) => {
                            return [...acc, ...group.elements];
                        }, []),
                    },
                ];
            });
            return res.status(200).json(questionsByPart);
        }
        catch (error) {
            console.error("Error fetching questions:", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    },
    getQuestionByPartAndExam: async (req, res) => {
        const { exam_id, part_id, page = 1, limit = 10 } = req.query;
        if (!exam_id || !part_id) {
            return res.status(400).json({
                error: "Exam or part is required!",
            });
        }
        try {
            const examPart = await prisma.examPart.findUnique({
                where: {
                    exam_id_part_id: {
                        exam_id: Number(exam_id),
                        part_id: Number(part_id),
                    },
                },
            });
            if (!examPart) {
                return res.status(404).json({
                    error: "Exam or part not found!",
                });
            }
            else {
                // Tính toán skip cho phân trang dựa trên số câu hỏi
                const skip = (Number(page) - 1) * Number(limit);
                // Lấy tổng số câu hỏi
                const totalQuestions = await prisma.question.count({
                    where: {
                        group: {
                            part_id: Number(part_id),
                            part: {
                                examParts: {
                                    some: {
                                        exam_id: Number(exam_id),
                                    },
                                },
                            },
                        },
                        deleted_at: null,
                    },
                });
                // Lấy tất cả các nhóm câu hỏi
                const allGroups = await prisma.questionGroup.findMany({
                    where: {
                        part_id: Number(part_id),
                        exam_id: Number(exam_id),
                    },
                    include: {
                        questions: {
                            where: {
                                deleted_at: null,
                            },
                            include: {
                                elements: true,
                            },
                            orderBy: {
                                global_order: "asc",
                            },
                        },
                        elements: true,
                    },
                    orderBy: {
                        order: "asc",
                    },
                });
                // Gộp tất cả câu hỏi từ các nhóm
                const allQuestions = allGroups.reduce((acc, group) => {
                    return [...acc, ...group.questions];
                }, []);
                // Phân trang câu hỏi
                const paginatedQuestions = allQuestions.slice(skip, skip + Number(limit));
                // Thêm số thứ tự tuần tự cho mỗi câu hỏi
                const questionsWithSequentialOrder = paginatedQuestions.map((question, index) => ({
                    ...question,
                    display_order: skip + index + 1, // Số thứ tự hiển thị = skip + index + 1
                }));
                // Tạo map để theo dõi các nhóm chứa câu hỏi đã phân trang
                const groupMap = new Map();
                questionsWithSequentialOrder.forEach((question) => {
                    const group = allGroups.find((g) => g.questions.some((q) => q.id === question.id));
                    if (group && !groupMap.has(group.id)) {
                        groupMap.set(group.id, {
                            ...group,
                            questions: group.questions
                                .filter((q) => questionsWithSequentialOrder.some((pq) => pq.id === q.id))
                                .map((q) => {
                                const updatedQuestion = questionsWithSequentialOrder.find((pq) => pq.id === q.id);
                                return updatedQuestion || q;
                            }),
                        });
                    }
                });
                // Chuyển map thành mảng
                const paginatedGroups = Array.from(groupMap.values());
                return res.status(200).json({
                    data: paginatedGroups,
                    total: totalQuestions,
                    page: Number(page),
                    limit: Number(limit),
                    totalPages: Math.ceil(totalQuestions / Number(limit)),
                });
            }
        }
        catch (err) {
            return res.status(500).json({
                message: err.message,
            });
        }
    },
    createQuestion: async (req, res) => {
        const { part_id, exam_id } = req.query;
        const { description, type_group, questions } = req.body;
        const files = req.files;
        let pathDir = "";
        if (!type_group) {
            let initialTypeG = 1;
        }
        if (!exam_id || !part_id) {
            return res.status(400).json({ error: "Exam or part is required!" });
        }
        const part_name = await prisma.part.findUnique({
            where: {
                id: Number(part_id),
            },
        });
        const exam_name = await prisma.exam.findUnique({
            where: {
                id: Number(exam_id),
            },
        });
        if (!part_name || !exam_name) {
            return res.status(404).json({ error: "Part or Exam not found" });
        }
        if (!pathDir) {
            const sanitizedExamName = exam_name.name.replace(/[^a-zA-Z0-9]/g, "_");
            const sanitizedPartName = part_name.name.replace(/[^a-zA-Z0-9]/g, "_");
            pathDir = `${sanitizedExamName}/${sanitizedPartName}`;
        }
        try {
            return await prisma.$transaction(async (tx) => {
                const lastGroup = await tx.questionGroup.findFirst({
                    where: {
                        part_id: Number(part_id),
                        exam_id: Number(exam_id),
                    },
                    orderBy: { order: "desc" },
                });
                const newGroup = await tx.questionGroup.create({
                    data: {
                        part_id: Number(part_id),
                        exam_id: Number(exam_id),
                        order: (lastGroup?.order ?? 0) + 1,
                        type_group: Number(type_group),
                        description,
                        title: req.body.title,
                    },
                });
                // Upload group elements
                const groupElements = files.filter((file) => file.fieldname === "elements");
                if (groupElements.length > 0) {
                    for (const el of groupElements) {
                        await tx.element.create({
                            data: {
                                type: el.mimetype.startsWith("image")
                                    ? "image"
                                    : "audio",
                                url: `/uploads/${pathDir}/${el.filename}`,
                                group_id: newGroup.id,
                            },
                        });
                    }
                }
                const maxGlobalOrder = await tx.question.findFirst({
                    where: {
                        group: {
                            part_id: Number(part_id),
                            exam_id: Number(exam_id),
                        },
                    },
                    orderBy: { global_order: "desc" },
                    select: { global_order: true },
                });
                const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    // Parse options from JSON string if it's a string
                    let options = q.option;
                    if (typeof options === "string") {
                        try {
                            options = JSON.parse(options);
                        }
                        catch (e) {
                            console.error("Error parsing options JSON:", e);
                            return res
                                .status(400)
                                .json({ error: "Invalid options format" });
                        }
                    }
                    const maxOrder = await tx.question.findFirst({
                        where: {
                            group: {
                                part_id: Number(part_id),
                                exam_id: Number(exam_id),
                            },
                        },
                        orderBy: { order: "desc" },
                        select: { order: true },
                    });
                    const startOrder = maxOrder?.order ?? 0;
                    // Create question with parsed options
                    const createdQuestion = await tx.question.create({
                        data: {
                            title: q.title,
                            description: q.description,
                            option: options, // Now storing as JSON object
                            correct_option: q.correct_option,
                            score: Number(q.score),
                            order: startOrder + i + 1,
                            group_id: newGroup.id,
                            global_order: startGlobalOrder + i + 1,
                            deleted_at: null,
                        },
                    });
                    // Upload question elements
                    const questionElements = files.filter((file) => file.fieldname.startsWith(`questions[${i}][elements]`));
                    if (questionElements.length > 0) {
                        for (const file of questionElements) {
                            await tx.element.create({
                                data: {
                                    type: file.mimetype.startsWith("image")
                                        ? "image"
                                        : "audio",
                                    url: `/uploads/${pathDir}/${file.filename}`,
                                    question_id: createdQuestion.id,
                                },
                            });
                        }
                    }
                }
                return res.status(201).json({
                    message: "Questions created successfully.",
                    newGroup: newGroup,
                });
            }, {
                maxWait: 10000,
                timeout: 20000,
            });
        }
        catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },
    update: async (req, res) => {
        const { question_id } = req.query;
        const { title, description, option, correct_option, score, global_order } = req.body;
        const files = req.files;
        console.log("Debug - Update request:", {
            question_id,
            files: files?.map((f) => ({
                filename: f.filename,
                path: f.path,
                fieldname: f.fieldname,
            })),
        });
        if (!question_id) {
            return res.status(400).json({ error: "Question ID is required!" });
        }
        try {
            return await prisma.$transaction(async (tx) => {
                // Get the question with its elements to check old file paths
                const existingQuestion = await tx.question.findUnique({
                    where: { id: Number(question_id) },
                    include: {
                        elements: true,
                        group: {
                            include: {
                                part: {
                                    include: {
                                        examParts: {
                                            include: {
                                                exam: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });
                if (!existingQuestion) {
                    return res.status(404).json({ error: "Question not found" });
                }
                console.log("Debug - Existing question:", {
                    id: existingQuestion.id,
                    elements: existingQuestion.elements,
                });
                // Use pathDir set by middleware
                const oldPathDir = req.pathDir;
                console.log("Debug - PathDir:", oldPathDir);
                // Parse options from JSON string if it's a string
                let parsedOptions = option;
                if (typeof option === "string") {
                    try {
                        parsedOptions = JSON.parse(option);
                    }
                    catch (e) {
                        console.error("Error parsing options JSON:", e);
                        return res.status(400).json({ error: "Invalid options format" });
                    }
                }
                // Update question with parsed options
                const updatedQuestion = await tx.question.update({
                    where: { id: Number(question_id) },
                    data: {
                        title,
                        description,
                        option: parsedOptions, // Now storing as JSON object
                        correct_option,
                        score: Number(score),
                        global_order: Number(global_order),
                    },
                });
                // Handle new files if any
                if (files && files.length > 0) {
                    console.log("Debug - Processing new files");
                    // Delete old elements and their files
                    for (const element of existingQuestion.elements) {
                        const filePath = path.join(process.cwd(), element.url);
                        console.log("Debug - Deleting old file:", filePath);
                        try {
                            await fs.unlink(filePath);
                        }
                        catch (error) {
                            console.error(`Error deleting file ${filePath}:`, error);
                        }
                    }
                    await tx.element.deleteMany({
                        where: { question_id: Number(question_id) },
                    });
                    // Create new elements with the same directory structure
                    const uploadedElements = files.map((file) => {
                        const element = {
                            type: file.mimetype.startsWith("image")
                                ? TypeElement.image
                                : TypeElement.audio,
                            url: `/uploads/${oldPathDir}/${file.filename}`,
                            question_id: Number(question_id),
                        };
                        console.log("Debug - Creating new element:", element);
                        return element;
                    });
                    await tx.element.createMany({ data: uploadedElements });
                }
                return res.status(200).json({
                    message: "Question updated successfully",
                    question: updatedQuestion,
                });
            });
        }
        catch (err) {
            console.error("Error updating question:", err);
            return res.status(500).json({ error: err.message });
        }
    },
    delete: async (req, res) => {
        const { question_id } = req.query;
        if (!question_id) {
            return res.status(400).json({ error: "Question ID is required!" });
        }
        try {
            const deletedQuestion = await prisma.question.update({
                where: { id: Number(question_id) },
                data: {
                    deleted_at: new Date(),
                },
            });
            return res.status(200).json({
                message: "Question deleted successfully",
                question: deletedQuestion,
            });
        }
        catch (err) {
            console.error("Error deleting question:", err);
            return res.status(500).json({ error: err.message });
        }
    },
    uploadExcel: async (req, res) => {
        try {
            const { file } = req.body;
            if (!file) {
                return res.status(400).json({
                    error: "Thiếu dữ liệu file Excel",
                });
            }
            const { detailQuestions, examAndSubject } = file;
            // Kiểm tra thông tin exam và subject
            if (!examAndSubject || examAndSubject.length === 0) {
                return res.status(400).json({
                    error: "Thiếu thông tin Exam và Subject trong file Excel",
                });
            }
            const { Subject, Exam } = examAndSubject[0];
            if (!Subject || !Exam) {
                return res.status(400).json({
                    error: "Thiếu tên Subject hoặc Exam trong file Excel",
                });
            }
            // Luôn tạo mới hoặc lấy subject đã tồn tại
            let subject = await prisma.subject.findFirst({
                where: { name: Subject, deleted_at: null },
            });
            if (!subject) {
                subject = await prisma.subject.create({
                    data: {
                        name: Subject,
                        deleted_at: null,
                    },
                });
            }
            // Luôn tạo mới hoặc lấy exam đã tồn tại
            let exam = await prisma.exam.findFirst({
                where: { name: Exam, deleted_at: null },
            });
            if (!exam) {
                exam = await prisma.exam.create({
                    data: {
                        name: Exam,
                        subject_id: subject.id,
                        deleted_at: null,
                    },
                });
                // Lấy tất cả các phần sẽ được sử dụng trong exam này
                const uniqueParts = [...new Set(detailQuestions.map((q) => q.Part))];
                // Tạo liên kết exam-part cho tất cả các phần
                for (const partName of uniqueParts) {
                    const part = await prisma.part.findFirst({
                        where: { name: partName },
                    });
                    if (part) {
                        // Tạo liên kết exam-part
                        await prisma.examPart.create({
                            data: {
                                exam_id: exam.id,
                                part_id: part.id,
                            },
                        });
                    }
                }
            }
            // Lấy thứ tự toàn cục lớn nhất cho exam này
            const maxGlobalOrder = await prisma.question.findFirst({
                where: {
                    group: {
                        exam_id: exam?.id,
                    },
                },
                orderBy: { global_order: "desc" },
                select: { global_order: true },
            });
            const startGlobalOrder = maxGlobalOrder?.global_order ?? 0;
            // Nhóm các câu hỏi theo Part
            const questionsByPart = detailQuestions.reduce((acc, question) => {
                const partName = question.Part;
                if (!partName) {
                    throw new Error("Thiếu thông tin Part trong file Excel");
                }
                if (!acc[partName]) {
                    acc[partName] = [];
                }
                acc[partName].push(question);
                return acc;
            }, {});
            // Kiểm tra xem tất cả các phần có tồn tại và lấy thứ tự của chúng
            const partOrders = new Map();
            for (const partName of Object.keys(questionsByPart)) {
                const existingPart = await prisma.part.findFirst({
                    where: { name: partName },
                });
                if (!existingPart) {
                    return res.status(400).json({
                        error: `Part "${partName}" không tồn tại trong hệ thống`,
                    });
                }
                // Lấy thứ tự phần từ examPart
                const examPart = await prisma.examPart.findFirst({
                    where: {
                        exam_id: exam.id,
                        part_id: existingPart.id,
                    },
                });
                // Nếu examPart không tồn tại (không nên xảy ra với exam mới, nhưng có thể với exam đã tồn tại)
                if (!examPart) {
                    // Tạo liên kết exam-part
                    const newExamPart = await prisma.examPart.create({
                        data: {
                            exam_id: exam.id,
                            part_id: existingPart.id,
                        },
                    });
                    partOrders.set(partName, newExamPart.id);
                }
                else {
                    partOrders.set(partName, examPart.id);
                }
            }
            // Sắp xếp các phần theo thứ tự
            const sortedPartNames = Object.keys(questionsByPart).sort((a, b) => {
                return (partOrders.get(a) || 0) - (partOrders.get(b) || 0);
            });
            // Xử lý từng phần
            const results = [];
            let currentGlobalOrder = startGlobalOrder;
            for (const partName of sortedPartNames) {
                const questions = questionsByPart[partName];
                const part = await prisma.part.findFirst({
                    where: { name: partName },
                });
                if (!part)
                    continue;
                // Lấy exam part
                const examPart = await prisma.examPart.findFirst({
                    where: {
                        exam_id: exam.id,
                        part_id: part.id,
                    },
                });
                if (!examPart) {
                    return res.status(400).json({
                        error: `Không tìm thấy liên kết giữa Exam "${Exam}" và Part "${partName}"`,
                    });
                }
                // Sắp xếp câu hỏi theo Order trong phần
                const sortedQuestions = [...questions].sort((a, b) => a.Order - b.Order);
                // Tạo nhóm câu hỏi
                const lastGroup = await prisma.questionGroup.findFirst({
                    where: {
                        part_id: part.id,
                        exam_id: exam.id,
                    },
                    orderBy: { order: "desc" },
                });
                const newGroup = await prisma.questionGroup.create({
                    data: {
                        part_id: part.id,
                        exam_id: exam.id,
                        order: (lastGroup?.order ?? 0) + 1,
                        type_group: 1,
                        description: sortedQuestions[0]["Description Group"] || "",
                        title: sortedQuestions[0]["Title Group"] || "",
                    },
                });
                // Tạo câu hỏi cho nhóm này
                for (let i = 0; i < sortedQuestions.length; i++) {
                    const q = sortedQuestions[i];
                    currentGlobalOrder++;
                    // Chuyển đổi các lựa chọn sang định dạng A, B, C, D
                    const options = {
                        A: q["Option A"],
                        B: q["Option B"],
                        C: q["Option C"],
                        D: q["Option D"],
                    };
                    // Chuyển đổi đáp án đúng sang định dạng mảng
                    const correctAnswer = q["Correct option"];
                    if (!correctAnswer) {
                        throw new Error(`Thiếu đáp án cho câu hỏi "${q.Question}"`);
                    }
                    // Chuyển đổi chuỗi đáp án sang giá trị enum Option
                    const correctOption = correctAnswer.replace("Option ", "");
                    const createdQuestion = await prisma.question.create({
                        data: {
                            title: q.Question,
                            description: q.Description || "",
                            option: options, // Lưu dưới dạng đối tượng key-value
                            correct_option: correctOption, // Lưu dưới dạng enum Option
                            score: 1, // Điểm mặc định
                            order: q.Order, // Sử dụng Order từ Excel
                            group_id: newGroup.id,
                            global_order: currentGlobalOrder, // Sử dụng thứ tự toàn cục tăng dần
                        },
                    });
                    // Xử lý phần tử nếu tồn tại
                    if (q.Element) {
                        // Kiểm tra xem URL phần tử có phải từ Cloudinary không
                        const isAudio = q.Element.toLowerCase().includes(".mp3") ||
                            q.Element.toLowerCase().includes(".wav");
                        await prisma.element.create({
                            data: {
                                type: isAudio ? "audio" : "image",
                                url: q.Element, // Sử dụng URL Cloudinary trực tiếp
                                question_id: createdQuestion.id,
                                cloudId: true,
                            },
                        });
                    }
                    // Xử lý phần tử nhóm nếu tồn tại
                    if (q["Element Group"] && i === 0) {
                        // Kiểm tra xem URL phần tử nhóm có phải từ Cloudinary không
                        const isAudio = q["Element Group"].toLowerCase().includes(".mp3") ||
                            q["Element Group"].toLowerCase().includes(".wav");
                        await prisma.element.create({
                            data: {
                                type: isAudio ? "audio" : "image",
                                url: q["Element Group"], // Sử dụng URL Cloudinary trực tiếp
                                group_id: newGroup.id,
                                cloudId: true,
                            },
                        });
                    }
                }
                results.push({
                    part: partName,
                    groupId: newGroup.id,
                    questionsCount: questions.length,
                });
            }
            return res.status(201).json({
                message: "Upload Excel thành công",
                results,
            });
        }
        catch (error) {
            console.error("Lỗi khi upload Excel:", error);
            return res.status(500).json({
                error: error.message || "Lỗi khi xử lý file Excel",
            });
        }
    },
};
