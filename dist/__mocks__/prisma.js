// __mocks__/prisma.ts
export const prisma = {
    part: {
        findUnique: jest.fn(),
    },
    exam: {
        findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    questionGroup: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    question: {
        findFirst: jest.fn(),
        create: jest.fn(),
    },
    element: {
        createMany: jest.fn(),
    },
};
