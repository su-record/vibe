import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
const PROFILES = {
    codex: {
        name: 'codex',
        contextBudget: 24_000,
        requiredSections: ['constraints', 'doneCriteria', 'evidenceRequired'],
        isolationPolicy: {
            reloadPerScenario: true,
            includeExplorationLogs: false,
            stateSource: 'disk',
        },
    },
    'claude-code': {
        name: 'claude-code',
        contextBudget: 20_000,
        requiredSections: ['constraints', 'doneCriteria', 'evidenceRequired'],
        isolationPolicy: {
            reloadPerScenario: true,
            includeExplorationLogs: false,
            stateSource: 'disk',
        },
    },
};
const MAX_SPEC_BYTES = 1_000_000;
const MAX_PACKET_BYTES = 256_000;
function normalizedHeading(line) {
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (!match)
        return null;
    return match[2].replace(/^\d+\.\s*/, '').replace(/\s*\(.+$/, '').trim().toLowerCase();
}
function sectionLines(markdown, title) {
    const lines = markdown.split('\n');
    const start = lines.findIndex(line => normalizedHeading(line) === title.toLowerCase());
    if (start < 0)
        return [];
    const level = lines[start].match(/^#+/)?.[0].length ?? 2;
    const end = lines.findIndex((line, index) => index > start
        && (line.match(/^#+/)?.[0].length ?? level + 1) <= level
        && /^#{2,3}\s+/.test(line));
    return lines.slice(start + 1, end < 0 ? undefined : end);
}
function listItems(markdown, title) {
    return sectionLines(markdown, title)
        .map(line => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
        .filter((item) => Boolean(item));
}
function parseCriteria(markdown, specPath) {
    const items = [];
    const pointers = [];
    const lines = sectionLines(markdown, 'Done Criteria');
    const sectionStart = markdown.split('\n').findIndex(line => normalizedHeading(line) === 'done criteria');
    lines.forEach((line, index) => {
        const match = line.match(/^\|\s*(D\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
        if (!match)
            return;
        items.push({ id: match[1], description: match[2].trim(), verifiedBy: match[3].trim() });
        pointers.push({ id: match[1], path: specPath, line: sectionStart + index + 2 });
    });
    return { items, pointers };
}
function parseRequirements(markdown) {
    return sectionLines(markdown, 'Requirements')
        .map(line => line.match(/^\|\s*(REQ-[^|\s]+)\s*\|\s*([^|]+)\|\s*([^|]+)\|/))
        .filter((match) => match !== null)
        .map(match => ({
        id: match[1],
        description: match[2].trim(),
        doneCriterionIds: match[3].split(',').map(id => id.trim()).filter(Boolean),
    }));
}
function parseEvidence(markdown) {
    return sectionLines(markdown, 'Evidence Required')
        .map(line => line.match(/^\s*-\s+((?:REQ-[^\s]+)|(?:D\d+))\s*→\s*(.+)$/))
        .filter((match) => match !== null)
        .map(match => ({ criterionId: match[1], evidence: match[2].trim() }));
}
function parseSpec(markdown, path) {
    const criteria = parseCriteria(markdown, path);
    return {
        requirements: parseRequirements(markdown),
        criteria: criteria.items,
        evidence: parseEvidence(markdown),
        constraints: listItems(markdown, 'Constraints'),
        rejectedAlternatives: listItems(markdown, 'Rejected Alternatives'),
        contextSources: listItems(markdown, 'Context Sources'),
        assumptions: listItems(markdown, 'Assumptions'),
        pointers: criteria.pointers,
    };
}
function effectiveRequirements(parsed) {
    if (parsed.requirements.length > 0)
        return parsed.requirements;
    return parsed.criteria.map(item => ({
        id: item.id,
        description: item.description,
        doneCriterionIds: [item.id],
    }));
}
function selectRequirements(parsed, selectedIds) {
    const requirements = effectiveRequirements(parsed);
    if (!selectedIds)
        return requirements;
    const selected = new Set(selectedIds);
    return requirements.filter(item => selected.has(item.id));
}
function requirementMappingErrors(parsed) {
    const requirements = effectiveRequirements(parsed);
    const knownCriteria = new Set(parsed.criteria.map(item => item.id));
    const errors = [];
    for (const requirement of requirements) {
        const unknown = requirement.doneCriterionIds.filter(id => !knownCriteria.has(id));
        if (unknown.length > 0)
            errors.push({
                code: 'INVALID_REQUIREMENT_MAPPING',
                message: `${requirement.id} maps to unknown criteria: ${unknown.join(', ')}`,
                sourceId: requirement.id,
            });
    }
    if (parsed.requirements.length === 0)
        return errors;
    const mapped = new Set(requirements.flatMap(item => item.doneCriterionIds));
    for (const criterion of parsed.criteria.filter(item => !mapped.has(item.id))) {
        errors.push({
            code: 'INVALID_REQUIREMENT_MAPPING',
            message: `${criterion.id} is not mapped by any requirement`,
            sourceId: criterion.id,
        });
    }
    return errors;
}
function evidenceErrors(parsed, selected) {
    const knownCriteria = new Set(parsed.criteria.map(item => item.id));
    const errors = [];
    for (const item of parsed.evidence) {
        if (!knownCriteria.has(item.criterionId))
            errors.push({
                code: 'UNKNOWN_EVIDENCE_ID',
                message: `Unknown evidence ID: ${item.criterionId}`,
                sourceId: item.criterionId,
            });
    }
    const evidenceIds = new Set(parsed.evidence.map(item => item.criterionId));
    const selectedCriteria = new Set(selected.flatMap(item => item.doneCriterionIds));
    for (const criterionId of selectedCriteria) {
        if (!knownCriteria.has(criterionId) || evidenceIds.has(criterionId))
            continue;
        const pointer = parsed.pointers.find(candidate => candidate.id === criterionId);
        errors.push({
            code: 'MISSING_EVIDENCE',
            message: `Missing evidence: ${criterionId}`,
            sourceId: criterionId,
            sourcePointer: pointer ? { path: pointer.path, line: pointer.line } : undefined,
        });
    }
    return errors;
}
function auditErrors(parsed, profile, selectedIds) {
    if (profile.requiredSections.includes('doneCriteria') && parsed.criteria.length === 0) {
        return [{ code: 'MISSING_DONE_CRITERIA', message: 'No contract criteria found' }];
    }
    if (profile.requiredSections.includes('constraints') && parsed.constraints.length === 0) {
        return [{ code: 'MISSING_REQUIRED_SECTION', message: 'Constraints section is required' }];
    }
    if (selectedIds?.length === 0) {
        return [{ code: 'EMPTY_SELECTION', message: 'Requirement selection cannot be empty' }];
    }
    const requirements = effectiveRequirements(parsed);
    const knownRequirements = new Set(requirements.map(item => item.id));
    const selected = selectRequirements(parsed, selectedIds);
    const errors = [];
    for (const id of selectedIds ?? []) {
        if (!knownRequirements.has(id))
            errors.push({ code: 'UNKNOWN_REQUIREMENT_ID', message: `Unknown ID: ${id}`, sourceId: id });
    }
    return [...errors, ...requirementMappingErrors(parsed), ...evidenceErrors(parsed, selected)];
}
function buildPacket(input, parsed) {
    const profile = PROFILES[input.profile];
    const requirements = selectRequirements(parsed, input.selectedRequirementIds);
    const ids = new Set(requirements.flatMap(item => item.doneCriterionIds));
    const criteria = parsed.criteria.filter(item => ids.has(item.id));
    return {
        schemaVersion: '1.0.0',
        compilerVersion: '1.0.0',
        profile: profile.name,
        canonicalSpecPath: input.canonicalSpecPath,
        canonicalSpecHash: createHash('sha256').update(input.canonicalSpec).digest('hex'),
        requirements,
        constraints: parsed.constraints,
        rejectedAlternatives: parsed.rejectedAlternatives,
        doneCriteria: criteria,
        evidenceRequired: parsed.evidence.filter(item => ids.has(item.criterionId)),
        contextSources: parsed.contextSources,
        assumptions: parsed.assumptions,
        isolationPolicy: { ...profile.isolationPolicy },
        contextBudget: profile.contextBudget,
        sourcePointers: parsed.pointers.filter(item => ids.has(item.id)),
    };
}
export function compileExecutionPacket(input) {
    if (!Object.hasOwn(PROFILES, input.profile)) {
        return {
            ok: false,
            errors: [{ code: 'INVALID_PROFILE', message: `Unsupported profile: ${input.profile}` }],
        };
    }
    const parsed = parseSpec(input.canonicalSpec, input.canonicalSpecPath);
    const errors = auditErrors(parsed, PROFILES[input.profile], input.selectedRequirementIds);
    if (errors.length > 0)
        return { ok: false, errors };
    const packet = buildPacket(input, parsed);
    if (JSON.stringify(packet).length > packet.contextBudget) {
        return {
            ok: false,
            errors: [{ code: 'BUDGET_EXCEEDED', message: `Packet exceeds ${packet.contextBudget} characters` }],
        };
    }
    return {
        ok: true,
        packet,
        audit: { preservedCriterionIds: packet.doneCriteria.map(item => item.id) },
    };
}
export function getHarnessProfile(name) {
    const profile = PROFILES[name];
    return {
        ...profile,
        requiredSections: [...profile.requiredSections],
        isolationPolicy: { ...profile.isolationPolicy },
    };
}
function resolveInside(projectPath, relativePath) {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, relativePath);
    return target === root || target.startsWith(`${root}${path.sep}`) ? target : null;
}
function hasSymlinkComponent(projectPath, targetPath) {
    const root = path.resolve(projectPath);
    const relative = path.relative(root, targetPath);
    let current = root;
    for (const component of relative.split(path.sep).filter(Boolean)) {
        current = path.join(current, component);
        if (!fs.existsSync(current))
            continue;
        if (fs.lstatSync(current).isSymbolicLink())
            return true;
    }
    return false;
}
function packetFeatureName(specPath) {
    const parsed = path.parse(specPath);
    const feature = parsed.name === '_index' ? path.basename(parsed.dir) : parsed.name;
    return /^[a-z0-9][a-z0-9-]*$/.test(feature) ? feature : null;
}
function writeJsonAtomic(targetPath, value) {
    const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
        fs.renameSync(temporaryPath, targetPath);
        return true;
    }
    catch {
        try {
            fs.rmSync(temporaryPath, { force: true });
        }
        catch { /* best effort */ }
        return false;
    }
}
function fileError(code, message) {
    return { ok: false, errors: [{ code, message }] };
}
export function writeExecutionPacket(input) {
    const specFile = resolveInside(input.projectPath, input.specPath);
    const feature = packetFeatureName(input.specPath);
    if (!specFile || !feature || hasSymlinkComponent(input.projectPath, specFile)) {
        return fileError('INVALID_PATH', 'SPEC path is outside the project or invalid');
    }
    try {
        const canonicalSpec = readTextLimited(specFile, MAX_SPEC_BYTES);
        const compiled = compileExecutionPacket({
            canonicalSpec,
            canonicalSpecPath: input.specPath,
            profile: input.profile,
            selectedRequirementIds: input.selectedRequirementIds,
        });
        if (!compiled.ok)
            return compiled;
        const packetPath = `.vibe/packets/${feature}/${input.profile}.json`;
        const packetFile = resolveInside(input.projectPath, packetPath);
        if (!packetFile || hasSymlinkComponent(input.projectPath, packetFile)) {
            return fileError('INVALID_PATH', 'Execution packet path contains a symbolic link');
        }
        if (!writeJsonAtomic(packetFile, compiled.packet)) {
            return fileError('FILE_IO', 'Execution packet write failed');
        }
        return { ok: true, packetPath, packet: compiled.packet };
    }
    catch {
        return fileError('FILE_IO', 'Canonical SPEC read failed');
    }
}
function packetRequirementIds(value) {
    if (!('requirements' in value) || !Array.isArray(value.requirements))
        return null;
    const ids = [];
    for (const requirement of value.requirements) {
        if (!requirement || typeof requirement !== 'object' || !('id' in requirement))
            return null;
        if (typeof requirement.id !== 'string')
            return null;
        ids.push(requirement.id);
    }
    return ids;
}
function readTextLimited(filePath, maxBytes) {
    if (fs.statSync(filePath).size > maxBytes)
        throw new Error('File exceeds size limit');
    return fs.readFileSync(filePath, 'utf-8');
}
function readPacket(packetFile) {
    try {
        const value = JSON.parse(readTextLimited(packetFile, MAX_PACKET_BYTES));
        if (!value || typeof value !== 'object')
            return null;
        if (!('canonicalSpecHash' in value) || !('canonicalSpecPath' in value))
            return null;
        if (!('profile' in value) || !('schemaVersion' in value))
            return null;
        const hash = value.canonicalSpecHash;
        const specPath = value.canonicalSpecPath;
        const profile = value.profile;
        const selectedRequirementIds = packetRequirementIds(value);
        if (value.schemaVersion !== '1.0.0')
            return null;
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))
            return null;
        if (typeof specPath !== 'string')
            return null;
        if (profile !== 'codex' && profile !== 'claude-code')
            return null;
        if (!selectedRequirementIds || selectedRequirementIds.length === 0)
            return null;
        return { canonicalSpecHash: hash, canonicalSpecPath: specPath, profile, selectedRequirementIds, raw: value };
    }
    catch {
        return null;
    }
}
export function validateExecutionPacket(input) {
    const specFile = resolveInside(input.projectPath, input.specPath);
    const packetFile = resolveInside(input.projectPath, input.packetPath);
    const expectedPrefix = `.vibe${path.sep}packets${path.sep}`;
    const normalizedPacketPath = path.normalize(input.packetPath);
    if (!specFile || !packetFile || !normalizedPacketPath.startsWith(expectedPrefix)) {
        return { valid: false, code: 'INVALID_PACKET', message: 'Packet path is invalid' };
    }
    if (hasSymlinkComponent(input.projectPath, specFile)
        || hasSymlinkComponent(input.projectPath, packetFile)) {
        return { valid: false, code: 'INVALID_PACKET', message: 'Packet path contains a symbolic link' };
    }
    const identity = readPacket(packetFile);
    if (!identity || identity.canonicalSpecPath !== input.specPath) {
        return { valid: false, code: 'INVALID_PACKET', message: 'Execution packet is unreadable' };
    }
    const feature = packetFeatureName(input.specPath);
    const expectedPacketPath = `.vibe/packets/${feature}/${identity.profile}.json`;
    if (!feature || path.normalize(expectedPacketPath) !== normalizedPacketPath) {
        return { valid: false, code: 'INVALID_PACKET', message: 'Execution packet identity is invalid' };
    }
    try {
        const canonicalSpec = readTextLimited(specFile, MAX_SPEC_BYTES);
        const specHash = createHash('sha256').update(canonicalSpec).digest('hex');
        if (identity.canonicalSpecHash !== specHash) {
            return { valid: false, code: 'STALE_PACKET', message: 'Execution packet does not match the current canonical SPEC' };
        }
        const compiled = compileExecutionPacket({
            canonicalSpec,
            canonicalSpecPath: input.specPath,
            profile: identity.profile,
            selectedRequirementIds: input.selectedRequirementIds,
        });
        if (!compiled.ok || JSON.stringify(compiled.packet) !== JSON.stringify(identity.raw)) {
            return { valid: false, code: 'INVALID_PACKET', message: 'Execution packet contract is invalid' };
        }
        return { valid: true };
    }
    catch {
        return { valid: false, code: 'INVALID_PACKET', message: 'Canonical SPEC is unreadable' };
    }
}
//# sourceMappingURL=executionPacket.js.map