// ===== Subtask Queue Module =====
// Provides a fallback queue implementation using localStorage when Firestore is unavailable

class SubtaskQueue {
  constructor(options = {}) {
    this.storage = options.storage || 'local'; // 'local' for localStorage, 'firebase' for Firestore
    this.userId = options.userId || 'anonymous';
    this.storageKey = `julesQueue_${this.userId}`;
    this.queue = [];
    this.initialized = false;
  }

  /**
   * Initialize the queue by loading from storage
   */
  async init() {
    if (this.initialized) return;

    try {
      if (this.storage === 'local') {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      }
      // Firebase storage would be handled differently, but since this is a fallback,
      // we focus on localStorage
      this.initialized = true;
    } catch (err) {
      console.error('Failed to initialize SubtaskQueue', err);
      this.queue = [];
      this.initialized = true;
    }
  }

  /**
   * Add an item to the queue
   * @param {object} item - The queue item to add
   * @returns {object} The added item with an id
   */
  async enqueue(item) {
    if (!this.initialized) {
      await this.init();
    }

    const queueItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
      status: item.status || 'pending'
    };

    this.queue.push(queueItem);
    await this.save();

    return queueItem;
  }

  /**
   * Remove an item from the queue by id
   * @param {string} id - The item id to remove
   * @returns {boolean} True if item was removed
   */
  async dequeue(id) {
    if (!this.initialized) {
      await this.init();
    }

    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    await this.save();

    return true;
  }

  /**
   * Get all items in the queue
   * @returns {array} Array of queue items
   */
  async getAll() {
    if (!this.initialized) {
      await this.init();
    }

    return [...this.queue];
  }

  /**
   * Update an item in the queue
   * @param {string} id - The item id to update
   * @param {object} updates - Fields to update
   * @returns {boolean} True if item was updated
   */
  async update(id, updates) {
    if (!this.initialized) {
      await this.init();
    }

    const item = this.queue.find(i => i.id === id);
    if (!item) return false;

    Object.assign(item, updates);
    await this.save();

    return true;
  }

  /**
   * Clear all items from the queue
   */
  async clear() {
    this.queue = [];
    await this.save();
  }

  /**
   * Save the queue to storage
   */
  async save() {
    try {
      if (this.storage === 'local') {
        localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      }
    } catch (err) {
      console.error('Failed to save queue to localStorage', err);
      throw err;
    }
  }

  /**
   * Generate a unique id for queue items
   * @returns {string} A unique identifier
   */
  generateId() {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SubtaskQueue;
