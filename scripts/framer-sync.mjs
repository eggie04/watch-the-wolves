import assert from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { connect } from "framer-api";

const SUPPORTED_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".css",
]);

function parseArgs(argv) {
    const flags = new Set(argv.slice(2));
    const has = (flag) => flags.has(flag);
    return {
        listOnly: has("--list-only"),
        dryRun: has("--dry-run"),
        allowOverwrite:
            has("--allow-overwrite") ||
            process.env.FRAMER_ALLOW_OVERWRITE === "1",
        publish:
            has("--publish") ||
            (!has("--no-publish") && process.env.FRAMER_PUBLISH === "1"),
    };
}

function normalizePath(p) {
    return String(p || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .replace(/\/+/g, "/")
        .trim();
}

function toPreferredRemotePath(relPath) {
    const clean = normalizePath(relPath);

    // Local folder naming differs from Framer remote folder naming.
    if (clean.startsWith("Wolves Schedule/")) {
        return clean.replace(/^Wolves Schedule\//, "WolvesSchedule/");
    }

    return clean;
}

function getRemotePathCandidates(relPath) {
    const preferred = toPreferredRemotePath(relPath);
    const direct = normalizePath(relPath);
    const out = [preferred];
    if (direct && direct !== preferred) out.push(direct);
    return out;
}

function joinRemotePath(prefix, relPath) {
    const cleanPrefix = normalizePath(prefix || "");
    const cleanRel = toPreferredRemotePath(relPath || "");
    if (!cleanPrefix) return cleanRel;
    if (!cleanRel) return cleanPrefix;
    return `${cleanPrefix}/${cleanRel}`;
}

function addPathKeys(map, key, value) {
    if (!key) return;
    const base = normalizePath(key);
    if (!base) return;

    const variants = new Set([
        base,
        base.toLowerCase(),
        base.replace(/^code\//i, ""),
        base.replace(/^src\/code\//i, ""),
    ]);

    for (const variant of variants) {
        if (variant) map.set(variant, value);
    }
}

async function getAllLocalFiles(rootDir) {
    const output = [];

    async function walk(dir) {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

            const relPath = normalizePath(path.relative(rootDir, fullPath));
            output.push({ fullPath, relPath });
        }
    }

    await walk(rootDir);
    return output.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function normalizeContent(content) {
    return String(content ?? "").replace(/\r\n/g, "\n");
}

function summarizeChanges(changedPaths) {
    const entries = Object.entries(changedPaths || {});
    const total = entries.reduce((sum, [, paths]) => {
        return sum + (Array.isArray(paths) ? paths.length : 0);
    }, 0);
    return { total, entries };
}

async function main() {
    const options = parseArgs(process.argv);
    const cwd = process.cwd();

    const projectUrl = process.env.FRAMER_PROJECT_URL;
    assert(
        projectUrl,
        "FRAMER_PROJECT_URL is required (set it in your env file)."
    );

    const apiKey = process.env.FRAMER_API_KEY || process.env.FRAMER_TOKEN;
    assert(
        apiKey,
        "FRAMER_API_KEY (or FRAMER_TOKEN) is required (set it in your env file)."
    );

    const localCodeDir = path.resolve(
        cwd,
        process.env.FRAMER_CODE_DIR || "Framer/Code"
    );
    const remotePrefix = process.env.FRAMER_REMOTE_PREFIX || "";

    console.log(`Project: ${projectUrl}`);
    console.log(`Local code dir: ${localCodeDir}`);
    console.log(
        `Remote prefix: ${remotePrefix ? `"${remotePrefix}"` : "(none)"}`
    );
    console.log(`Mode: ${options.listOnly ? "list-only" : "sync"}`);
    console.log(
        `Overwrite protection: ${options.allowOverwrite ? "disabled" : "enabled"}`
    );

    const framer = await connect(projectUrl, apiKey);
    try {
        const remoteCodeFiles = await framer.getCodeFiles();
        console.log(`Remote code files: ${remoteCodeFiles.length}`);

        if (options.listOnly) {
            for (const file of remoteCodeFiles) {
                console.log(`- ${file.path}`);
            }
            return;
        }

        const remoteByPath = new Map();
        for (const file of remoteCodeFiles) {
            addPathKeys(remoteByPath, file.path, file);
        }

        const localFiles = await getAllLocalFiles(localCodeDir);
        console.log(`Local code files: ${localFiles.length}`);

        const created = [];
        const updated = [];
        const skipped = [];
        const protectedSkipped = [];
        const errors = [];

        for (const local of localFiles) {
            const remotePath = joinRemotePath(remotePrefix, local.relPath);
            const localContent = normalizeContent(
                await readFile(local.fullPath, "utf8")
            );

            const pathCandidates = getRemotePathCandidates(local.relPath).map(
                (candidate) => joinRemotePath(remotePrefix, candidate)
            );
            const remoteFile =
                pathCandidates
                    .flatMap((candidate) => [
                        candidate,
                        candidate.toLowerCase(),
                        `code/${candidate}`,
                        `code/${candidate}`.toLowerCase(),
                    ])
                    .map((key) => remoteByPath.get(key))
                    .find(Boolean) || null;

            if (!remoteFile) {
                created.push({ path: remotePath, content: localContent });
                continue;
            }

            const remoteContent = normalizeContent(remoteFile.content);
            if (remoteContent === localContent) {
                skipped.push(remotePath);
                continue;
            }

            if (!options.allowOverwrite) {
                protectedSkipped.push(remotePath);
                continue;
            }

            updated.push({
                path: remotePath,
                content: localContent,
                remoteFile,
            });
        }

        console.log(
            `Sync summary -> created: ${created.length}, updated: ${updated.length}, protected: ${protectedSkipped.length}, unchanged: ${skipped.length}`
        );

        if (created.length) {
            console.log("Created:");
            created.forEach(({ path: p }) => console.log(`  + ${p}`));
        }
        if (updated.length) {
            console.log("Updated:");
            updated.forEach(({ path: p }) => console.log(`  ~ ${p}`));
        }
        if (protectedSkipped.length) {
            console.log("Protected (remote differs):");
            protectedSkipped.forEach((p) => console.log(`  ! ${p}`));
        }

        if (errors.length) {
            console.log("Errors:");
            errors.forEach((p) => console.log(`  ! ${p}`));
        }

        if (options.dryRun) {
            console.log("Dry run complete; no remote changes were applied.");
            return;
        }

        if (protectedSkipped.length) {
            throw new Error(
                "Refused to overwrite differing remote files. Re-run with --allow-overwrite (or FRAMER_ALLOW_OVERWRITE=1) when you intentionally want local files to win."
            );
        }

        for (const file of created) {
            await framer.createCodeFile(file.path, file.content);
        }
        for (const file of updated) {
            await file.remoteFile.setFileContent(file.content);
        }

        const changedPaths = await framer.getChangedPaths();
        const { total, entries } = summarizeChanges(changedPaths);
        if (total === 0) {
            console.log("No pending Framer project changes.");
            return;
        }

        console.log(`Pending Framer changes: ${total}`);
        for (const [type, paths] of entries) {
            for (const p of paths || []) {
                console.log(`  ${type}: ${p}`);
            }
        }

        if (!options.publish) {
            console.log("Sync complete (publish skipped).");
            return;
        }

        const { deployment } = await framer.publish();
        console.log(`Published deployment ${deployment.id}`);

        const deployed = await framer.deploy(deployment.id);
        if (deployed.length) {
            console.log("Deployed custom domains:");
            for (const hostname of deployed) {
                console.log(`  https://${hostname.hostname}`);
            }
        } else {
            console.log("No custom domains to deploy.");
        }
    } finally {
        await framer.disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
