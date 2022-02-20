import * as path from 'path'
import worker_threads from 'worker_threads'
import { TWorkerCommand, TWorkerResult } from './index.worker'
import { TTask, TTaskState, TTicketResult, TTicketResultServer } from './task'
import { TypeMetronom } from 'vv-metronom'
export { TTask, TTaskState, TypeMetronom, TTicketResult, TTicketResultServer }

export interface IApp {
    start(): void,
    finish(): void,
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
        finish: () => {
            worker.postMessage({kind: 'finish'} as TWorkerCommand)
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