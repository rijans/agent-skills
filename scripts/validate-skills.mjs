#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const rootDir = resolve(dirname(new URL(import.meta.url).pathname), "..");
const skillsDir = join(rootDir, "skills");
const examplesDir = join(rootDir, "examples");

let errors = 0;
function fail(msg) {
  console.error(`✗ ${msg}`);
  errors++;
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

const skillFolders = readdirSync(skillsDir).filter((name) =>
  statSync(join(skillsDir, name)).isDirectory()
);

if (skillFolders.length === 0) {
  fail("No skill directories found under skills/");
}

// 1. Validate each skill's SKILL.md, frontmatter, and relative links
for (const skill of skillFolders) {
  const skillPath = join(skillsDir, skill);
  const skillMdPath = join(skillPath, "SKILL.md");

  if (!existsSync(skillMdPath)) {
    fail(`Missing SKILL.md in skills/${skill}/`);
    continue;
  }

  const evalMdPath = join(skillPath, "eval.md");
  if (!existsSync(evalMdPath)) {
    fail(`Missing eval.md in skills/${skill}/`);
  }

  const openaiYamlPath = join(skillPath, "agents", "openai.yaml");
  if (!existsSync(openaiYamlPath)) {
    fail(`Missing agents/openai.yaml in skills/${skill}/`);
  }

  const content = readFileSync(skillMdPath, "utf8");
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    fail(`Missing YAML frontmatter in skills/${skill}/SKILL.md`);
    continue;
  }

  const fm = fmMatch[1];
  const nameMatch = fm.match(/^name:\s*(.+)$/m);
  const descMatch = fm.match(/^description:\s*(.+)$/m);

  if (!nameMatch || nameMatch[1].trim() !== skill) {
    fail(
      `skills/${skill}/SKILL.md frontmatter 'name' must match directory name '${skill}'`
    );
  }

  if (!descMatch || !descMatch[1].trim()) {
    fail(`skills/${skill}/SKILL.md is missing a frontmatter 'description'`);
  } else {
    const desc = descMatch[1].trim();
    if (desc.length > 1024) {
      fail(
        `skills/${skill}/SKILL.md description exceeds 1024 chars (${desc.length})`
      );
    }
    const firstSentenceMatch = desc.match(/^([^.!?]+[.!?])/);
    const firstSentence = firstSentenceMatch ? firstSentenceMatch[1].trim() : desc;
    if (firstSentence.length < 140 || firstSentence.length > 152) {
      fail(
        `skills/${skill}/SKILL.md first sentence of description is ${firstSentence.length} chars (must be 140–152 chars for skills.sh/Google meta description)`
      );
    }
  }

  // Check relative markdown links in SKILL.md and references/*.md
  const mdFiles = [skillMdPath];
  const refsDir = join(skillPath, "references");
  if (existsSync(refsDir) && statSync(refsDir).isDirectory()) {
    for (const ref of readdirSync(refsDir)) {
      if (ref.endsWith(".md")) mdFiles.push(join(refsDir, ref));
    }
  }

  for (const mdFile of mdFiles) {
    const mdText = readFileSync(mdFile, "utf8");
    const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(mdText)) !== null) {
      const target = m[1].split("#")[0].trim();
      if (
        !target ||
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("mailto:")
      ) {
        continue;
      }
      const resolved = resolve(dirname(mdFile), target);
      if (!existsSync(resolved)) {
        fail(`Broken relative link '${target}' in ${mdFile.replace(rootDir + "/", "")}`);
      }
    }
  }

  pass(`Validated skills/${skill}/SKILL.md and references`);
}

// 2. Validate examples/*.js syntax with node --check
if (existsSync(examplesDir)) {
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith(".js") || full.endsWith(".mjs")) {
        try {
          execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
          pass(`Syntax check passed: ${full.replace(rootDir + "/", "")}`);
        } catch (err) {
          fail(`Syntax error in ${full.replace(rootDir + "/", "")}: ${err.message}`);
        }
      }
    }
  };
  walk(examplesDir);
}

// 3. Validate JSON manifests & registry synchronization
const jsonManifests = [
  "skills.sh.json",
  ".claude-plugin/marketplace.json",
  ".claude-plugin/plugin.json",
  ".cursor-plugin/marketplace.json",
  ".cursor-plugin/plugin.json",
];

for (const relPath of jsonManifests) {
  const fullPath = join(rootDir, relPath);
  if (!existsSync(fullPath)) {
    fail(`Missing manifest file: ${relPath}`);
    continue;
  }
  try {
    const parsed = JSON.parse(readFileSync(fullPath, "utf8"));
    if (relPath === "skills.sh.json") {
      const listed = new Set(
        (parsed.groupings || []).flatMap((g) => g.skills || [])
      );
      for (const s of skillFolders) {
        if (!listed.has(s)) {
          fail(`Skill '${s}' is missing from skills.sh.json groupings`);
        }
      }
    }
    if (relPath.endsWith("marketplace.json")) {
      const listed = new Set((parsed.plugins || []).map((p) => p.name));
      for (const s of skillFolders) {
        if (!listed.has(s)) {
          fail(`Skill '${s}' is missing from ${relPath} plugins list`);
        }
      }
    }
    pass(`Validated manifest: ${relPath}`);
  } catch (err) {
    fail(`Invalid JSON in ${relPath}: ${err.message}`);
  }
}

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\nAll ${skillFolders.length} skills, examples, and registry manifests passed validation!`);
}
