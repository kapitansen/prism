"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const argon2_1 = require("@node-rs/argon2");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const USERS = [
    { email: 'eugene@prism.local', password: '12345', isDemo: false },
    { email: 'demo@prism.local', password: '12345', isDemo: true },
];
async function main() {
    for (const u of USERS) {
        const passwordHash = await (0, argon2_1.hash)(u.password);
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { passwordHash },
            create: {
                email: u.email,
                passwordHash,
                isDemo: u.isDemo,
                settings: { create: {} },
            },
        });
        console.log(`seeded user ${user.email} (${user.id})`);
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exitCode = 1;
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map