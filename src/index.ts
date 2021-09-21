//import worker_threads from 'worker_threads'

export interface IApp {
    start(): void,
}

export function create(callback?: (error: Error | undefined) => void): IApp {
    try {
        return {
            start: () => {},
        }
    } catch (error) {
        if (typeof callback === 'function') {
            callback(error as Error)
        } else {
            throw error
        }
        return {
            start: () => {},
        }
    }
}