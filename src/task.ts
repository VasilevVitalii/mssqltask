import * as vvs from 'vv-shared'
import { Metronom, TypeMetronom } from './metronom'

export type TypeServer = {
    instance: string,
    login: string,
    password: string
}

export type TypeTask = {
    metronom: TypeMetronom
    servers: TypeServer[]

}

export class Type {
    private metronom: Metronom
    private servers: TypeServer[]
    private needStop: boolean

    constructor(options: TypeTask) {
        this.metronom = new Metronom(options.metronom)
        this.servers = options.servers
        this.metronom.ontick(() => {
            console.log('tick!')
        })
        this.metronom.start()
    }

    stop() {
        this.metronom.stop()
        this.needStop = true
    }
}