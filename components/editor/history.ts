export interface HistoryEntry {
  undo: () => void
  redo: () => void
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private maxSize = 50

  push(entry: HistoryEntry) {
    this.undoStack.push(entry)
    if (this.undoStack.length > this.maxSize) this.undoStack.shift()
    this.redoStack = []
  }

  undo(): boolean {
    const entry = this.undoStack.pop()
    if (!entry) return false
    entry.undo()
    this.redoStack.push(entry)
    return true
  }

  redo(): boolean {
    const entry = this.redoStack.pop()
    if (!entry) return false
    entry.redo()
    this.undoStack.push(entry)
    return true
  }

  get canUndo() {
    return this.undoStack.length > 0
  }

  get canRedo() {
    return this.redoStack.length > 0
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
  }
}
