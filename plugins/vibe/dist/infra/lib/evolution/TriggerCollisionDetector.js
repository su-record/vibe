// Trigger Collision Detection for self-evolution Phase 3
// Prevents duplicate/conflicting trigger patterns
export class TriggerCollisionDetector {
    /**
     * Check if new triggers collide with existing skills
     */
    checkCollision(newTriggers, existingSkills) {
        const normalizedNew = newTriggers.map(t => t.toLowerCase().trim());
        for (const skill of existingSkills) {
            const normalizedExisting = skill.triggers.map(t => t.toLowerCase().trim());
            // Exact collision
            for (const newT of normalizedNew) {
                for (const existT of normalizedExisting) {
                    if (newT === existT) {
                        return {
                            hasCollision: true,
                            type: 'exact',
                            collidingWith: skill.name,
                            message: `Exact trigger collision: "${newT}" already used by "${skill.name}"`,
                        };
                    }
                }
            }
            // Prefix collision
            for (const newT of normalizedNew) {
                for (const existT of normalizedExisting) {
                    if (newT.startsWith(existT) || existT.startsWith(newT)) {
                        return {
                            hasCollision: true,
                            type: 'prefix',
                            collidingWith: skill.name,
                            message: `Prefix trigger collision: "${newT}" overlaps with "${existT}" in "${skill.name}"`,
                        };
                    }
                }
            }
        }
        return { hasCollision: false, type: 'none' };
    }
    /**
     * Detect circular trigger chains using DFS
     * @param skills All active skills with their trigger patterns and content
     */
    detectCircularChain(skills) {
        const MAX_DEPTH = 10;
        const graph = new Map();
        // Build trigger graph
        for (const skill of skills) {
            graph.set(skill.name, { name: skill.name, triggers: skill.triggers, edges: [] });
        }
        // Build edges: if skill A's content contains skill B's trigger → A→B edge
        for (const [nameA, nodeA] of graph) {
            const skillA = skills.find(s => s.name === nameA);
            if (!skillA)
                continue;
            const contentLower = skillA.content.toLowerCase();
            for (const [nameB, nodeB] of graph) {
                if (nameA === nameB)
                    continue;
                for (const trigger of nodeB.triggers) {
                    if (contentLower.includes(trigger.toLowerCase())) {
                        nodeA.edges.push(nameB);
                        break;
                    }
                }
            }
        }
        // DFS for cycles
        const cycles = [];
        const visited = new Set();
        const stack = new Set();
        const dfs = (node, path, depth) => {
            if (depth > MAX_DEPTH)
                return;
            if (stack.has(node)) {
                const cycleStart = path.indexOf(node);
                if (cycleStart >= 0) {
                    cycles.push([...path.slice(cycleStart), node]);
                }
                return;
            }
            if (visited.has(node))
                return;
            visited.add(node);
            stack.add(node);
            path.push(node);
            const edges = graph.get(node)?.edges || [];
            for (const next of edges) {
                dfs(next, path, depth + 1);
            }
            path.pop();
            stack.delete(node);
        };
        for (const name of graph.keys()) {
            dfs(name, [], 0);
        }
        return cycles;
    }
}
//# sourceMappingURL=TriggerCollisionDetector.js.map