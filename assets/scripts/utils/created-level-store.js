// Keep the small level list in localStorage for existing menus. Large level
// payloads live in IndexedDB, so importing a level cannot fill that list's quota.
window.CreatedLevelStore = {
  _db: null,
  _opening: null,
  async open() {
    if (this._db) return this._db;
    if (!this._opening) {
      this._opening = new Promise((resolve, reject) => {
        const request = indexedDB.open('GDLevelDB', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('levels');
        request.onsuccess = () => {
          this._db = request.result;
          this._db.onversionchange = () => { this._db.close(); this._db = null; this._opening = null; };
          resolve(this._db);
        };
        request.onerror = () => { this._opening = null; reject(request.error); };
      });
    }
    return this._opening;
  },
  async loadData(level) {
    // Older saved levels and freshly imported in-memory records still work.
    if (typeof level.levelString === 'string' && level.levelString) return level.levelString;
    const db = await this.open();
    const data = await new Promise((resolve, reject) => {
      const request = db.transaction('levels', 'readonly').objectStore('levels')
        .get(level.levelDataKey || level.createdId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (typeof data !== 'string' || !data) throw new Error('The saved level data could not be found.');
    return data;
  },
  async save(levels) {
    const db = await this.open();
    const records = levels.map(level => {
      const record = { ...level };
      if (typeof record.levelString === 'string' && record.levelString) {
        record.levelDataKey = record.createdId;
        delete record.levelString;
      }
      return record;
    });
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('levels', 'readwrite');
      const store = transaction.objectStore('levels');
      for (const level of levels) {
        if (typeof level.levelString === 'string' && level.levelString) {
          store.put(level.levelString, level.createdId);
        }
      }
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error || new Error('Level save was aborted.'));
      transaction.onerror = () => reject(transaction.error);
    });
    // Publish the new list only after all payloads have been saved. Existing
    // inline records are migrated without deleting their previous list first.
    localStorage.setItem('created_levels', JSON.stringify(records));
  },
  async removeData(level) {
    const db = await this.open();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('levels', 'readwrite');
      transaction.objectStore('levels').delete(level.levelDataKey || level.createdId);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }
};
