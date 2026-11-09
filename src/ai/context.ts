import { db } from '../db/db'
import { getSettings } from '../db/repo'
import type { ToolContext } from './tools'

export async function loadToolContext(): Promise<ToolContext> {
  const [settings, lessons, subjects, events, contacts, tasks, pantry, shopping] = await Promise.all([
    getSettings(),
    db.lessons.toArray(),
    db.subjects.toArray(),
    db.events.toArray(),
    db.contacts.toArray(),
    db.tasks.toArray(),
    db.pantry.toArray(),
    db.shopping.toArray(),
  ])
  return { settings, lessons, subjects, events, contacts, tasks, pantry, shopping }
}
