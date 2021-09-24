import * as fs from 'fs'
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

export type TypeMessage = {
    text: string,
    type: 'info' | 'error'
}

export type TypeExecResult =
    {kind: 'start', spid: number} |
    {kind: 'stop', duration: number, error: Error, messages: TypeMessage[]}

export type TypeExecResultToFile =
    {kind: 'start', spid: number} |
    {kind: 'stop', duration: number, error: Error}

export type TypeExecResultToSend =
    {kind: 'start', spid: number} |
    {kind: 'process', table_index: number, table_rows: any[], messages: TypeMessage[]} |
    {kind: 'stop', duration: number, error: Error}

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

    exec(queries: string[], callback: (result: TypeExecResult) => void) {
        this.ping(false, () => {
            if (this.ping_result.error) {
                callback({
                    kind: 'stop',
                    duration: 0,
                    error: this.ping_result.error,
                    messages: []
                })
                return
            }
            this.server.exec(queries, {allow_tables: false, database: 'master', get_spid: true, stop_on_error: true}, exec_result => {
                if (exec_result.type === 'spid') {
                    callback({
                        kind: 'start',
                        spid: exec_result.spid || -1
                    })
                    return
                }
                if (exec_result.type === 'end') {
                    callback({
                        kind: 'stop',
                        duration: 0,
                        error: this.ping_result.error,
                        messages: exec_result.end.message_list.map(m => { return {text: m.message, type: m.type} }) || []
                    })
                    return
                }
            })
        })
    }

    exec_to_file(queries: string[], tables_full_file_name: string, messages_full_file_name: string, callback: (result: TypeExecResultToFile) => void) {
        this.ping(false, () => {
            if (this.ping_result.error) {
                callback({
                    kind: 'stop',
                    duration: 0,
                    error: this.ping_result.error
                })
                return
            }

            let tables_stream = undefined as fs.WriteStream
            let messages_stream = undefined as fs.WriteStream

            try {
                if (!vvs.isEmptyString(tables_full_file_name)) {
                    tables_stream = fs.createWriteStream(tables_full_file_name, 'utf8')
                    // tables_stream.on('drain',() => {
                    //     console.log('tables_stream FINISH!')
                    // })
                }
                if (!vvs.isEmptyString(messages_full_file_name)) {
                    messages_stream = fs.createWriteStream(messages_full_file_name, 'utf8')
                }
            } catch (error) {
                callback({
                    kind: 'stop',
                    duration: 0,
                    error: this.ping_result.error
                })
                return
            }

            let error_stream = undefined as Error
            let has_tables = false
            let has_messages = false
            let write_tables = 0
            let write_messages = 0

            this.server.exec(queries, {allow_tables: true, chunk: {type: 'msec', chunk: 200}, database: 'master', get_spid: true, null_to_undefined: true, stop_on_error: true}, exec_result => {
                if (exec_result.type === 'spid') {
                    callback({
                        kind: 'start',
                        spid: vvs.toInt(exec_result.spid, -1)
                    })
                    return
                }
                if (exec_result.type === 'chunk') {
                    if (tables_stream && !error_stream && exec_result.chunk.table && exec_result.chunk.table.row_list && exec_result.chunk.table.row_list.length > 0) {
                        if (!has_tables) {
                            write_tables++
                            tables_stream.write('[\n', error => {
                                write_tables--
                                error_stream = error
                            })
                            has_tables = true
                        }
                        const table_index = vvs.toInt(exec_result.chunk.table.table_index, -1)
                        write_tables++
                        tables_stream.write(exec_result.chunk.table.row_list.map(m => { return JSON.stringify({table_index: table_index, row: m}) }).join(',\n').concat(',\n'), error => {
                            console.log('WRITE STOP')
                            write_tables--
                            if (vvs.isEmpty(error)) return
                            error_stream = error
                        })
                    }
                    if (messages_stream && !error_stream && exec_result.chunk.message_list && exec_result.chunk.message_list.length > 0) {
                        if (!has_messages) {
                            write_messages++
                            messages_stream.write('[\n', error => {
                                write_messages--
                                error_stream = error
                            })
                            has_messages = true
                        }
                        write_messages++
                        messages_stream.write(exec_result.chunk.message_list.map(m => { return JSON.stringify({text: m.message, type: m.type}) }).join(',\n').concat(',\n'), error => {
                            write_messages--
                            if (vvs.isEmpty(error)) return
                            error_stream = error
                        })
                    }
                    return
                }
                if (exec_result.type === 'end') {
                    console.log('END!', write_tables, write_messages)
                    this.exec_to_file_write_end([
                        vvs.isEmpty(error_stream) && has_tables === true ? tables_stream : undefined,
                        vvs.isEmpty(error_stream) && has_messages === true ? messages_stream : undefined,
                    ], 0, error => {
                        if (!vvs.isEmpty(error)) {
                            error_stream = error
                        }
                        // try {
                        //     tables_stream.close()
                        //     messages_stream.close()
                        // // eslint-disable-next-line no-empty
                        // } catch (error) {}
                        callback({
                            kind: 'stop',
                            duration: vvs.toFloat(exec_result.end.duration, 0),
                            error: vvs.isEmpty(error_stream) ? exec_result.end.error : error_stream
                        })
                    })
                }
            })
        })
    }

    private exec_to_file_write_end(streams: fs.WriteStream[], idx: number, callback: (error: Error) => void) {
        if (idx >= streams.length) {
            callback(undefined)
            return
        }
        if (vvs.isEmpty(streams[idx])) {
            idx++
            this.exec_to_file_write_end(streams, idx, callback)
            return
        }
        streams[idx].write(']', error => {
            if (vvs.isEmpty(error)) {
                idx++
                this.exec_to_file_write_end(streams, idx, callback)
                return
            }
            callback(error)
        })
    }

    exec_to_send(queries: string[], callback: (result: TypeExecResultToSend) => void ) {
        this.ping(false, () => {
            if (this.ping_result.error) {
                callback({
                    kind: 'stop',
                    duration: 0,
                    error: this.ping_result.error
                })
                return
            }
            this.server.exec(queries, {allow_tables: true, chunk: {type: 'msec', chunk: 200}, database: 'master', get_spid: true, null_to_undefined: true, stop_on_error: true}, exec_result => {
                if (exec_result.type === 'spid') {
                    callback({
                        kind: 'start',
                        spid: exec_result.spid || -1
                    })
                    return
                }
                if (exec_result.type === 'chunk') {
                    callback({
                        kind: 'process',
                        table_index: exec_result.chunk.table?.table_index || -1,
                        table_rows: exec_result.chunk.table?.row_list || [],
                        messages: exec_result.chunk?.message_list.map(m => { return {text: m.message, type: m.type} }) || []
                    })
                    return
                }
                if (exec_result.type === 'end') {
                    callback({
                        kind: 'stop',
                        duration: exec_result.end.duration || 0,
                        error: exec_result.end.error
                    })
                    return
                }
            })
        })
    }
}