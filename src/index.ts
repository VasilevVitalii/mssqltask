//import worker_threads from 'worker_threads'

import * as path from 'path'
import worker_threads from 'worker_threads'
import { TWorkerCommand, TWorkerResult } from './index.worker'
import { TTask, TTaskState } from './task'
export { TTask, TTaskState }

export interface IApp {
    start(): void,
    stop(): void,
    onError(callback:(error: string) => void): void,
    onChanged(callback:(state: TTaskState) => void): void
    maxWorkersSet(value: number): void
}

export function Create(options: TTask): IApp {
    const worker = new worker_threads.Worker(path.join(__dirname, 'index.worker.js'), {
        workerData: options
    })
    worker.on('message', (result: TWorkerResult) => {
        switch (result.kind) {
            case 'state':
                if (callbackOnChanged) {
                    callbackOnChanged(result.state)
                }
                break
            case 'error': {
                if (callbackOnError) {
                    callbackOnError(result.error)
                }
                break
            }
            default: {
                if (callbackOnError) {
                    callbackOnError(`unknown TypeWorkerResult ${result}`)
                }
            }
        }
    })

    let callbackOnError = undefined as (error: string) => void
    let callbackOnChanged = undefined as (state: TTaskState) => void

    return {
        start: () => {
            worker.postMessage({kind: 'start'} as TWorkerCommand)
        },
        stop: () => {
            worker.postMessage({kind: 'stop'} as TWorkerCommand)
        },
        onError: (callback) => {
            callbackOnError = callback
        },
        onChanged: (callback) => {
            callbackOnChanged = callback
        },
        maxWorkersSet(value: number) {
            worker.postMessage({kind: 'maxWorkers', maxWorkers: value} as TWorkerCommand)
        },
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