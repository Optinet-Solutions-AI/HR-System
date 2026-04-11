import path from 'path'

const AUTH_DIR = path.join(__dirname, '../.auth')

export const AUTH_FILES = {
  employee4d: path.join(AUTH_DIR, 'employee4d.json'),
  employee5d: path.join(AUTH_DIR, 'employee5d.json'),
  hradmin: path.join(AUTH_DIR, 'hradmin.json'),
} as const
