// Knowledge Graph operations for memory relationships
// Extracted from MemoryManager for better separation of concerns
export class KnowledgeGraph {
    db;
    storage;
    constructor(storage) {
        this.storage = storage;
        this.db = storage.getDatabase();
    }
    /**
     * Link two memories with a relationship
     */
    linkMemories(sourceKey, targetKey, relationType, strength = 1.0, metadata) {
        const timestamp = new Date().toISOString();
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        try {
            const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO memory_relations
        (sourceKey, targetKey, relationType, strength, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run(sourceKey, targetKey, relationType, strength, metadataJson, timestamp);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get all relations for a memory
     */
    getRelations(key, direction = 'both') {
        let sql = '';
        if (direction === 'outgoing') {
            sql = `SELECT * FROM memory_relations WHERE sourceKey = ?`;
        }
        else if (direction === 'incoming') {
            sql = `SELECT * FROM memory_relations WHERE targetKey = ?`;
        }
        else {
            sql = `SELECT * FROM memory_relations WHERE sourceKey = ? OR targetKey = ?`;
        }
        const stmt = this.db.prepare(sql);
        const rows = direction === 'both'
            ? stmt.all(key, key)
            : stmt.all(key);
        return rows.map(row => ({
            sourceKey: row.sourceKey,
            targetKey: row.targetKey,
            relationType: row.relationType,
            strength: row.strength,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            timestamp: row.timestamp
        }));
    }
    /**
     * Get related memories using graph traversal
     */
    getRelatedMemories(key, depth = 1, relationType) {
        const visited = new Set([key]);
        const result = [];
        let currentLevel = [key];
        for (let d = 0; d < depth; d++) {
            const nextLevel = [];
            for (const currentKey of currentLevel) {
                const relations = this.getRelations(currentKey, 'both');
                for (const rel of relations) {
                    if (relationType && rel.relationType !== relationType)
                        continue;
                    const neighborKey = rel.sourceKey === currentKey ? rel.targetKey : rel.sourceKey;
                    if (!visited.has(neighborKey)) {
                        visited.add(neighborKey);
                        nextLevel.push(neighborKey);
                    }
                }
            }
            if (nextLevel.length > 0) {
                const placeholders = nextLevel.map(() => '?').join(',');
                const rows = this.db.prepare(`SELECT * FROM memories WHERE key IN (${placeholders})`).all(...nextLevel);
                const timestamp = new Date().toISOString();
                const updateStmt = this.db.prepare('UPDATE memories SET lastAccessed = ? WHERE key = ?');
                for (const row of rows) {
                    updateStmt.run(timestamp, row.key);
                    result.push(row);
                }
            }
            currentLevel = nextLevel;
            if (currentLevel.length === 0)
                break;
        }
        return result;
    }
    /**
     * Get memory graph structure
     */
    getMemoryGraph(key, depth = 2) {
        const nodes = [];
        const edges = [];
        const visited = new Set();
        if (key) {
            this.buildGraphFromKey(key, depth, visited, nodes, edges);
        }
        else {
            const allMemories = this.storage.list();
            for (const memory of allMemories) {
                const relations = this.getRelations(memory.key, 'outgoing');
                nodes.push({
                    key: memory.key,
                    value: memory.value,
                    category: memory.category,
                    relations
                });
                edges.push(...relations);
            }
        }
        const clusters = this.detectClusters(nodes, edges);
        return { nodes, edges, clusters };
    }
    buildGraphFromKey(startKey, depth, visited, nodes, edges) {
        const queue = [{ key: startKey, level: 0 }];
        while (queue.length > 0) {
            const { key, level } = queue.shift();
            if (visited.has(key) || level > depth)
                continue;
            visited.add(key);
            const memory = this.storage.recall(key);
            if (!memory)
                continue;
            const relations = this.getRelations(key, 'both');
            nodes.push({
                key: memory.key,
                value: memory.value,
                category: memory.category,
                relations
            });
            for (const rel of relations) {
                if (!edges.some(e => e.sourceKey === rel.sourceKey &&
                    e.targetKey === rel.targetKey &&
                    e.relationType === rel.relationType)) {
                    edges.push(rel);
                }
                const neighborKey = rel.sourceKey === key ? rel.targetKey : rel.sourceKey;
                if (!visited.has(neighborKey) && level < depth) {
                    queue.push({ key: neighborKey, level: level + 1 });
                }
            }
        }
    }
    detectClusters(nodes, edges) {
        const parent = {};
        for (const node of nodes) {
            parent[node.key] = node.key;
        }
        const find = (x) => {
            if (parent[x] !== x) {
                parent[x] = find(parent[x]);
            }
            return parent[x];
        };
        const union = (x, y) => {
            const px = find(x);
            const py = find(y);
            if (px !== py) {
                parent[px] = py;
            }
        };
        for (const edge of edges) {
            if (parent[edge.sourceKey] !== undefined && parent[edge.targetKey] !== undefined) {
                union(edge.sourceKey, edge.targetKey);
            }
        }
        const clusters = {};
        for (const node of nodes) {
            const root = find(node.key);
            if (!clusters[root]) {
                clusters[root] = [];
            }
            clusters[root].push(node.key);
        }
        return Object.values(clusters).filter(c => c.length > 1);
    }
    /**
     * Find shortest path between two memories
     */
    findPath(sourceKey, targetKey) {
        const visited = new Set();
        const queue = [
            { key: sourceKey, path: [sourceKey] }
        ];
        while (queue.length > 0) {
            const { key, path } = queue.shift();
            if (key === targetKey) {
                return path;
            }
            if (visited.has(key))
                continue;
            visited.add(key);
            const relations = this.getRelations(key, 'both');
            for (const rel of relations) {
                const neighborKey = rel.sourceKey === key ? rel.targetKey : rel.sourceKey;
                if (!visited.has(neighborKey)) {
                    queue.push({ key: neighborKey, path: [...path, neighborKey] });
                }
            }
        }
        return null;
    }
    /**
     * Remove a relationship between memories
     */
    unlinkMemories(sourceKey, targetKey, relationType) {
        let sql = `DELETE FROM memory_relations WHERE sourceKey = ? AND targetKey = ?`;
        const params = [sourceKey, targetKey];
        if (relationType) {
            sql += ` AND relationType = ?`;
            params.push(relationType);
        }
        const result = this.db.prepare(sql).run(...params);
        return result.changes > 0;
    }
}
//# sourceMappingURL=KnowledgeGraph.js.map