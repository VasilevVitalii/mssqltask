import * as mssql from 'vv-mssql'
import * as vvs from 'vv-shared'

export type TypeStorage = {
    title: string,
    note: string,
    instance: string,
    login: string,
    password: string,
    tags: string[]
}

export type TypeExecResult =
    {kind: 'spid', spid: number}

export class Server {
    private server: mssql.app

    readonly storage: TypeStorage
    readonly key: string
    readonly ping_result: {
        time: Date,
        error: Error,
        duration_msec: number
    }
    readonly server_info: {
        timezone: number,
        version: string
    }

    constructor(storage: TypeStorage, app_name = 'mssqltask') {
        const instance = (storage.instance || '').replace(/\\/g, '/')

        this.key = instance
        const tags_raw = storage.tags || []
        const tags = [] as string[]
        tags_raw.forEach(t => {
            if (vvs.isEmptyString(t)) return
            t = t.trim()
            if (tags.some(f => vvs.equal(f, t))) return
            tags.push(t)
        })

        this.storage = {
            title: storage.title || storage.instance || '',
            note: storage.note || '',
            instance: instance,
            login: storage.login || '',
            password: storage.password || '',
            tags: tags
        }

        this.ping_result = {
            error: undefined,
            time: undefined,
            duration_msec: undefined
        }
        this.server_info = {
            timezone: 0,
            version: ''
        }

        this.server = mssql.create({
            instance: instance.replace(/\\/g, '\\'),
            login: this.storage.login,
            password: this.storage.password,
            beautify_instance: 'change',
            additional: {
                app_name: vvs.isEmptyString(app_name) ? 'mssqltask' : app_name
            }
        })
    }

    ping(force: boolean, callback: () => void) {
        if (!force && this.ping_result.time && !this.ping_result.error) {
            callback()
            return
        }
        this.server.ping(error => {
            this.ping_result.time = new Date()
            if (error) {
                this.ping_result.error = error
                this.ping_result.duration_msec = undefined
                this.server_info.timezone = 0
                this.server_info.version = ''
            } else {
                this.ping_result.error = undefined
                this.ping_result.duration_msec = this.server.server_info().ping.ping_duration_msec
                this.server_info.timezone = this.server.server_info().ping.timezone || 0
                this.server_info.version = this.server.server_info().ping.version || ''
            }
            callback()
        })
    }

    // exec(queries: string[], allow_tables: boolean, callback: (error: Error, result: TypeExecResult) => void ) {
    //     this.ping(false, () => {
    //         if (this.ping_error) {
    //             callback(this.ping_error, undefined)
    //             return
    //         }
    //         this.server.exec(queries, {allow_tables: allow_tables, chunk: {type: 'msec', chunk: 1000}, database: 'master', get_spid: true, null_to_undefined: true, stop_on_error: true}, (exec_result => {
    //             if (exec_result.type === 'spid') {
    //                 callback(undefined, {kind: 'spid', spid: exec_result.spid || 0})
    //                 return
    //             }
    //             // if (exec_result.type === 'chunk') {
    //             //     exec_result.chunk.table.
    //             // }
    //         }))
    //     })
    // }
}