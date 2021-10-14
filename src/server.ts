import * as mssql from 'vv-mssql'
import * as vv from 'vv-common'

export type TServer = {
    instance: string,
    login: string,
    password: string
}

export type TMessage = {
    text: string,
    type: 'info' | 'error'
}

export type TRow = {
    tableIndex: number
    row: any
}

export type TExecResultStart = {kind: 'start', spid: number}
export type TExecResultRows = {kind: 'rows', data: TRow[]}
export type TExecResultMessages = {kind: 'messages', data: TMessage[]}
export type TExecResultStop = {kind: 'stop', duration: number, error: Error}
export type TExecResult = TExecResultStart | TExecResultRows | TExecResultMessages | TExecResultStop

export class Server {
    private _server: mssql.app
    readonly options: TServer

    constructor(storage: TServer, appName = 'mssqltask') {
        this.options = {
            instance: storage.instance || '',
            login: storage.login || '',
            password: storage.password || '',
        }

        this._server = mssql.create({
            instance: this.options.instance.replace(/\//g, '\\'),
            login: this.options.login,
            password: this.options.password,
            beautify_instance: 'change',
            additional: {
                app_name: vv.isEmpty(appName) ? 'mssqltask' : appName
            }
        })
    }

    exec(query: string, allowRows: boolean, allowMessages: boolean, callback: (result: TExecResult) => void) {
        this._server.exec(query, {allow_tables: allowRows, database: 'master', get_spid: true, stop_on_error: true, chunk: {type: 'msec', chunk: 500}, null_to_undefined: true}, execResult => {
            if (execResult.type === 'spid') {
                callback({
                    kind: 'start',
                    spid: execResult.spid || 0
                })
            } else if (execResult.type === 'chunk') {
                if (allowRows && execResult.chunk.table.row_list.length > 0) {
                    callback({
                        kind: 'rows',
                        data: execResult.chunk.table.row_list.map(m => { return {tableIndex: execResult.chunk.table.table_index, row: m} })
                    })
                }
                if (allowMessages && execResult.chunk.message_list.length > 0) {
                    callback({
                        kind: 'messages',
                        data: execResult.chunk.message_list.map(m => { return {text: m.message, type: m.type} })
                    })
                }
            } else if (execResult.type === 'end') {
                if (allowRows && execResult.end.table_list.some(f => f.row_list.length > 0)) {
                    const data = [] as TRow[]
                    execResult.end.table_list.filter(f => f.row_list.length > 0).forEach(table => {
                        data.push(...table.row_list.map(m => { return {tableIndex: table.table_index, row: m} }))
                    })
                    callback({
                        kind: 'rows',
                        data: data
                    })
                }
                if (allowMessages && execResult.end.message_list.length > 0) {
                    callback({
                        kind: 'messages',
                        data: execResult.end.message_list.map(m => { return {text: m.message, type: m.type} })
                    })
                }
                callback({
                    kind: 'stop',
                    duration: Math.round(execResult.end.duration || 0),
                    error: execResult.end.error
                })
            }
        })
    }
}