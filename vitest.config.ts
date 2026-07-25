import { defineConfig } from "vitest/config";

// Vitest transpiles without typechecking; `npm run typecheck` (tsconfig.test.json) is what
// checks types across src + test. Keeping the two separate means one runner, one mode.
export default defineConfig({
    test: {
        include: ["test/**/*.test.ts"],
    },
});
