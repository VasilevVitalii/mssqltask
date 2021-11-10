import * as vv from 'vv-common'
import * as mssqldriver from 'mssqldriver'

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
    private _server: mssqldriver.IApp
    readonly options: TServer

    constructor(storage: TServer, appName = 'mssqltask') {
        this.options = {
            instance: storage.instance || '',
            login: storage.login || '',
            password: storage.password || '',
        }

        this._server = mssqldriver.Create({
            authentication: 'sqlserver',
            instance: this.options.instance.replace(/\//g, '\\'),
            login: this.options.login,
            password: this.options.password,
            additional: {
                appName: vv.isEmpty(appName) ? 'mssqltask' : appName
            }
        })
    }

    exec(queries: string[], allowRows: boolean, allowMessages: boolean, callback: (result: TExecResult) => void) {
        let tableIndex = -1
        this._server.exec(queries, {formatCells: 'string', receiveTables: allowRows ? 500 : 'none', receiveMessage: allowMessages ? 'directly' : 'none', hasSpid: true}, execResult => {
            if (execResult.kind === 'spid') {
                callback({
                    kind: 'start',
                    spid: execResult.spid || 0
                })
            } else if (execResult.kind === 'columns') {
                tableIndex++
            } else if (execResult.kind === 'rows') {
                callback({
                    kind: 'rows',
                    data: execResult.rows.map(m => { return {tableIndex: tableIndex, row: m} })
                })
            } else if (execResult.kind === 'message') {
                callback({
                    kind: 'messages',
                    data: [{text: execResult.message.message, type: execResult.message.isError ? 'error' : 'info' }]
                })
            } else if (execResult.kind === 'finish') {
                callback({
                    kind: 'stop',
                    duration: Math.round(execResult.finish.duration.total || 0) ,
                    error: execResult.finish.error
                })
            }
        })
    }
}