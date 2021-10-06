import { workerData, parentPort } from 'worker_threads'
import { Task, TypeTask, TypeTaskState } from './task'

const env = {
    options: workerData as TypeTask
}

export type TypeWorkerCommand =
    { kind: 'start'} |
    { kind: 'stop' } |
    { kind: 'maxWorkers', maxWorkers: number}


export type TypeWorkerResult =
    { kind: 'state', state: TypeTaskState } |
    { kind: 'error', error: string }

const task = new Task(env.options)

parentPort.on('message', (command: TypeWorkerCommand) => {
    switch (command.kind) {
        case 'start':
            task.start()
            break
        case 'stop':
            task.stop()
            break
        case 'maxWorkers':
            task.maxWorkers = command.maxWorkers
            break
        default:
            parentPort.postMessage({
                kind: 'error',
                error: `unknown TypeWorkerCommand ${command}`
            } as TypeWorkerResult)
    }
})

task.onChanged(state => {
    parentPort.postMessage({
        kind: 'state',
        state: state
    } as TypeWorkerResult)
})

task.onError(error => {
    parentPort.postMessage({
        kind: 'error',
        error: error?.message
    } as TypeWorkerResult)
})

