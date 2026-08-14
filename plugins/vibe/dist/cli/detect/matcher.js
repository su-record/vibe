/**
 * Generic matchers that walk the signature tables to produce detection results.
 * Each function is ≤50 lines and cyclomatic ≤10.
 */
import path from 'path';
import fs from 'fs';
import { NODE_STACK_SIGNATURES, PYTHON_STACK_SIGNATURES, FILE_MANIFEST_STACKS, GRADLE_STACK_SIGNATURES, MAVEN_STACK_SIGNATURES, SWIFT_STACK_SIGNATURES, RUBY_STACK_SIGNATURES, CSHARP_STACK_SIGNATURES, GODOT_STACK_SIGNATURES, DATABASE_SIGNATURES, STATE_MANAGEMENT_SIGNATURES, CAPABILITY_SIGNATURES, HOSTING_SIGNATURES, CICD_SIGNATURES, } from './signatures.js';
// ── internal helpers ───────────────────────────────────────────────────────
function readText(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return '';
    }
}
function readPkg(dir) {
    try {
        const raw = JSON.parse(readText(path.join(dir, 'package.json')));
        return { ...raw.dependencies, ...raw.devDependencies };
    }
    catch {
        return {};
    }
}
function hasPkg(dir) {
    const raw = readText(path.join(dir, 'package.json'));
    if (!raw)
        return false;
    try {
        const p = JSON.parse(raw);
        return typeof p.name === 'string';
    }
    catch {
        return false;
    }
}
function depsMatch(deps, keys) {
    return keys.some(k => k in deps);
}
function contentMatch(text, needles) {
    if (needles.length === 0)
        return true; // empty = always matches (fallback)
    return needles.some(n => text.includes(n));
}
// ── stack matchers ─────────────────────────────────────────────────────────
/** Match Node/TS stacks from package.json deps (first-match wins). */
function matchNodeStack(dir, prefix) {
    if (!fs.existsSync(path.join(dir, 'package.json')))
        return null;
    const deps = readPkg(dir);
    for (const sig of NODE_STACK_SIGNATURES) {
        if (sig.packageDeps && depsMatch(deps, sig.packageDeps)) {
            return { type: sig.type, path: prefix };
        }
    }
    // fallback: plain package.json with a name
    if (hasPkg(dir))
        return { type: 'typescript-node', path: prefix };
    return null;
}
/** Match Python stacks from pyproject.toml or requirements.txt (first-match wins). */
function matchPythonStack(dir, prefix) {
    const pyproject = path.join(dir, 'pyproject.toml');
    const requirements = path.join(dir, 'requirements.txt');
    const manifestPath = fs.existsSync(pyproject) ? pyproject
        : fs.existsSync(requirements) ? requirements
            : null;
    if (!manifestPath)
        return null;
    const text = readText(manifestPath);
    for (const sig of PYTHON_STACK_SIGNATURES) {
        if (contentMatch(text, sig.contentIncludes ?? [])) {
            return { type: sig.type, path: prefix };
        }
    }
    return null;
}
/** Match stacks that have a single manifest file (Flutter, Go, Rust). */
function matchFileManifestStacks(dir, prefix) {
    return FILE_MANIFEST_STACKS
        .filter(sig => sig.manifestFile && fs.existsSync(path.join(dir, sig.manifestFile)))
        .map(sig => ({ type: sig.type, path: prefix }));
}
/** Match Gradle-based JVM stacks (first-match wins). */
function matchGradleStack(dir, prefix) {
    const kts = path.join(dir, 'build.gradle.kts');
    const groovy = path.join(dir, 'build.gradle');
    const gradlePath = fs.existsSync(kts) ? kts : fs.existsSync(groovy) ? groovy : null;
    if (!gradlePath)
        return null;
    const text = readText(gradlePath);
    for (const sig of GRADLE_STACK_SIGNATURES) {
        if (contentMatch(text, sig.contentIncludes ?? [])) {
            return { type: sig.type, path: prefix };
        }
    }
    return null;
}
/** Match Maven-based JVM stacks (first-match wins). */
function matchMavenStack(dir, prefix) {
    if (!fs.existsSync(path.join(dir, 'pom.xml')))
        return null;
    const text = readText(path.join(dir, 'pom.xml'));
    for (const sig of MAVEN_STACK_SIGNATURES) {
        if (contentMatch(text, sig.contentIncludes ?? [])) {
            return { type: sig.type, path: prefix };
        }
    }
    return null;
}
/** Match predicate-based stacks (Swift, C#/Unity, Godot, Ruby). */
function matchPredicateStacks(dir, prefix, signatures) {
    return signatures
        .filter(sig => sig.predicate ? sig.predicate(dir, readPkg(dir)) : false)
        .map(sig => ({ type: sig.type, path: prefix }));
}
/** Match Ruby/Rails stack. */
function matchRubyStack(dir, prefix) {
    const gemfile = path.join(dir, 'Gemfile');
    if (!fs.existsSync(gemfile))
        return null;
    const text = readText(gemfile);
    for (const sig of RUBY_STACK_SIGNATURES) {
        if (contentMatch(text, sig.contentIncludes ?? [])) {
            return { type: sig.type, path: prefix };
        }
    }
    return null;
}
// ── detail matchers ────────────────────────────────────────────────────────
function matchDatabasesFromDeps(deps, sigs) {
    return sigs
        .filter(s => s.packageDeps && depsMatch(deps, s.packageDeps))
        .map(s => s.name);
}
function matchDatabasesFromContent(text, sigs) {
    return sigs
        .filter(s => s.contentIncludes && s.contentIncludes.length > 0 && contentMatch(text, s.contentIncludes))
        .map(s => s.name);
}
function matchStateFromDeps(deps, sigs) {
    return sigs
        .filter(s => s.packageDeps && depsMatch(deps, s.packageDeps))
        .map(s => s.name);
}
function matchStateFromContent(text, sigs) {
    return sigs
        .filter(s => s.contentIncludes && s.contentIncludes.length > 0 && contentMatch(text, s.contentIncludes))
        .map(s => s.name);
}
function hasEventAutomationDir(dir, sig) {
    if (!sig.requiresDirs)
        return true;
    return sig.requiresDirs.some(d => fs.existsSync(path.join(dir, d)));
}
function matchCapabilitiesFromDeps(dir, deps, sigs) {
    return sigs
        .filter(s => s.packageDeps && depsMatch(deps, s.packageDeps) && hasEventAutomationDir(dir, s))
        .map(s => s.capability);
}
function matchCapabilitiesFromContent(dir, text, sigs) {
    return sigs
        .filter(s => s.contentIncludes &&
        s.contentIncludes.length > 0 &&
        contentMatch(text, s.contentIncludes) &&
        hasEventAutomationDir(dir, s))
        .map(s => s.capability);
}
// ── per-directory detail collection ───────────────────────────────────────
function collectNodeDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'package.json')))
        return;
    const deps = readPkg(dir);
    details.databases.push(...matchDatabasesFromDeps(deps, DATABASE_SIGNATURES));
    details.stateManagement.push(...matchStateFromDeps(deps, STATE_MANAGEMENT_SIGNATURES));
    details.capabilities.push(...matchCapabilitiesFromDeps(dir, deps, CAPABILITY_SIGNATURES));
}
function collectPythonDetails(dir, details) {
    const pyproject = path.join(dir, 'pyproject.toml');
    const requirements = path.join(dir, 'requirements.txt');
    const filePath = fs.existsSync(pyproject) ? pyproject
        : fs.existsSync(requirements) ? requirements
            : null;
    if (!filePath)
        return;
    const text = readText(filePath);
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
    details.capabilities.push(...matchCapabilitiesFromContent(dir, text, CAPABILITY_SIGNATURES));
}
function collectFlutterDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'pubspec.yaml')))
        return;
    const text = readText(path.join(dir, 'pubspec.yaml'));
    details.stateManagement.push(...matchStateFromContent(text, STATE_MANAGEMENT_SIGNATURES));
}
function collectGoDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'go.mod')))
        return;
    const text = readText(path.join(dir, 'go.mod'));
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
}
function collectRustDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'Cargo.toml')))
        return;
    const text = readText(path.join(dir, 'Cargo.toml'));
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
}
function collectGradleDetails(dir, details) {
    const kts = path.join(dir, 'build.gradle.kts');
    const groovy = path.join(dir, 'build.gradle');
    const gradlePath = fs.existsSync(kts) ? kts : fs.existsSync(groovy) ? groovy : null;
    if (!gradlePath)
        return;
    const text = readText(gradlePath);
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
}
function collectMavenDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'pom.xml')))
        return;
    const text = readText(path.join(dir, 'pom.xml'));
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
}
function collectRubyDetails(dir, details) {
    if (!fs.existsSync(path.join(dir, 'Gemfile')))
        return;
    const text = readText(path.join(dir, 'Gemfile'));
    details.databases.push(...matchDatabasesFromContent(text, DATABASE_SIGNATURES));
}
// ── public API ─────────────────────────────────────────────────────────────
/**
 * Detect all stacks and collect detail signals from a single directory.
 * Returns detected stacks (may be empty).
 */
export function detectInDir(dir, prefix, details) {
    const stacks = [];
    const nodeStack = matchNodeStack(dir, prefix);
    if (nodeStack)
        stacks.push(nodeStack);
    const pythonStack = matchPythonStack(dir, prefix);
    if (pythonStack)
        stacks.push(pythonStack);
    stacks.push(...matchFileManifestStacks(dir, prefix));
    const gradleStack = matchGradleStack(dir, prefix);
    if (gradleStack)
        stacks.push(gradleStack);
    const mavenStack = matchMavenStack(dir, prefix);
    if (mavenStack)
        stacks.push(mavenStack);
    const rubyStack = matchRubyStack(dir, prefix);
    if (rubyStack)
        stacks.push(rubyStack);
    stacks.push(...matchPredicateStacks(dir, prefix, SWIFT_STACK_SIGNATURES));
    stacks.push(...matchPredicateStacks(dir, prefix, CSHARP_STACK_SIGNATURES));
    stacks.push(...matchPredicateStacks(dir, prefix, GODOT_STACK_SIGNATURES));
    collectNodeDetails(dir, details);
    collectPythonDetails(dir, details);
    collectFlutterDetails(dir, details);
    collectGoDetails(dir, details);
    collectRustDetails(dir, details);
    collectGradleDetails(dir, details);
    collectMavenDetails(dir, details);
    collectRubyDetails(dir, details);
    return stacks;
}
/** Detect hosting providers from the project root. */
export function detectHosting(projectRoot) {
    return HOSTING_SIGNATURES
        .filter(sig => sig.files.some(f => fs.existsSync(path.join(projectRoot, f))))
        .map(sig => sig.name);
}
/** Detect CI/CD tools from the project root. */
export function detectCicd(projectRoot) {
    return CICD_SIGNATURES
        .filter(sig => sig.files.some(f => fs.existsSync(path.join(projectRoot, f))))
        .map(sig => sig.name);
}
//# sourceMappingURL=matcher.js.map