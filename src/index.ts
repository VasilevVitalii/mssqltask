//import worker_threads from 'worker_threads'

import * as path from 'path'
import worker_threads from 'worker_threads'
import { TypeWorkerCommand, TypeWorkerResult } from './index.worker'
import { TypeTask, TypeTaskState } from './task'

export interface IApp {
    start(): void,
    stop(): void,
    onError(callback:(error: string) => void): void,
    onChanged(callback:(state: TypeTaskState) => void): void
}

export function createTask(options: TypeTask): IApp {
    const worker = new worker_threads.Worker(path.join(__dirname, 'index.worker.js'), {
        workerData: options
    })
    worker.on('message', (result: TypeWorkerResult) => {
        switch (result.kind) {
            case 'state':
                if (callback_onChanged) {
                    callback_onChanged(result.state)
                }
                break
            case 'error': {
                if (callback_onError) {
                    callback_onError(result.error)
                }
                break
            }
            default: {
                if (callback_onError) {
                    callback_onError(`unknown TypeWorkerResult ${result}`)
                }
            }
        }
    })

    let callback_onError = undefined as (error: string) => void
    let callback_onChanged = undefined as (state: TypeTaskState) => void

    return {
        start: () => {
            worker.postMessage({kind: 'start'} as TypeWorkerCommand)
        },
        stop: () => {
            worker.postMessage({kind: 'stop'} as TypeWorkerCommand)
        },
        onError: (callback) => {
            callback_onError = callback
        },
        onChanged: (callback) => {
            callback_onChanged = callback
        }
    }
}

/*

app (facade) with task list
    worker by each task
        worker by each exec

log/yyyyddmm/task1/hhmmssmmm.json
log/yyyyddmm/task1/hhmmssmmm/rows_0.json
log/yyyyddmm/task1/hhmmssmmm/messages_0.json


VVVVVVVVVVVVVVVV
log/yyyyddmm/task/tickets/     t.task.yyyyddmm.hhmmssmmm.json
log/yyyyddmm/task/rows/        r.task.idx.yyyyddmm.hhmmssmmm.json
log/yyyyddmm/task/messages/    m.task.idx.yyyyddmm.hhmmssmmm.json
VVVVVVVVVVVVVVVV

log/task/yyyyddmm/tickets/     t.task.yyyyddmm.hhmmssmmm.json
log/task/yyyyddmm/rows/        r.task.yyyyddmm.hhmmssmmm.json
log/task/yyyyddmm/messages/    m.task.yyyyddmm.hhmmssmmm.json


ticket
    dateStart
    dateStop
    execDurationMsec
    execError
    countRows
    countMessages
*/