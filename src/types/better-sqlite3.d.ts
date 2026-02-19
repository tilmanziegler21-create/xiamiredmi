declare module 'better-sqlite3' {
  type Statement = {
    run: (...args: any[]) => any
    get: (...args: any[]) => any
    all: (...args: any[]) => any
    pluck: () => Statement
  }

  export type DatabaseInstance = {
    pragma: (s: string) => void
    exec: (sql: string) => void
    prepare: (sql: string) => Statement
    transaction: <T extends (...args: any[]) => any>(fn: T) => T
  }

  export default class Database {
    constructor(path: string)
    pragma(s: string): void
    exec(sql: string): void
    prepare(sql: string): Statement
    transaction<T extends (...args: any[]) => any>(fn: T): T
  }

  export namespace Database {
    export type Database = DatabaseInstance
  }
}
