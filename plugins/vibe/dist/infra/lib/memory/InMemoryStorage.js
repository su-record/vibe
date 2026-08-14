export class InMemoryStorage {
    store = new Map();
    save(key, value, category = 'general', priority = 0) {
        const timestamp = new Date().toISOString();
        this.store.set(key, { key, value, category, timestamp, lastAccessed: timestamp, priority });
    }
    recall(key) {
        const item = this.store.get(key);
        if (!item)
            return null;
        const updated = { ...item, lastAccessed: new Date().toISOString() };
        this.store.set(key, updated);
        return updated;
    }
    update(key, value) {
        const item = this.store.get(key);
        if (!item)
            return false;
        const timestamp = new Date().toISOString();
        this.store.set(key, { ...item, value, timestamp, lastAccessed: timestamp });
        return true;
    }
    delete(key) {
        return this.store.delete(key);
    }
    list(category) {
        const items = Array.from(this.store.values());
        const filtered = category ? items.filter(i => i.category === category) : items;
        return filtered.sort((a, b) => {
            const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.timestamp.localeCompare(a.timestamp);
        });
    }
    search(query) {
        const lower = query.toLowerCase();
        return Array.from(this.store.values()).filter(item => item.key.toLowerCase().includes(lower) || item.value.toLowerCase().includes(lower));
    }
    close() {
        this.store.clear();
    }
}
//# sourceMappingURL=InMemoryStorage.js.map