import * as lib from '../src'
import * as data from './data'
import * as server from '../src/server'
import * as job from '../src/job'

const servers = data.servers()
servers_ping(servers, 0, () => {
    servers.forEach(s => {
        if (s.ping_result.error) {
            console.warn(`ERROR PING SERVER ${s.storage.instance}`)
            console.warn(s.ping_result.error)
            process.exit()
        }
    })
})

const job1 = new job.Job({kind: 'cron', cron: '0 */1 * * * *'})
job1.ontick(() => {
    console.log(`job1 tick with crop ${job1.cron().cron}`)
    job1.stop()
})
const job1_started = job1.start()
console.log(`job1 started? - ${job1_started}`)

const job2 = new job.Job({kind: 'scheduler', period_minutes: 1, periodicity: 'every', weekday_sun: true, weekday_mon: true, weekday_wed: true, weekday_thu: true, weekday_fri: true, weekday_tue: true, weekday_sat: true})
job2.ontick(() => {
    console.log(`job2 tick with crop ${job2.cron().cron}`)
    job2.stop()
})
const job2_started = job2.start()
console.log(`job2 started? - ${job2_started}`)

const job3 = new job.Job({kind: 'cron', cron: 'xxx'})
job3.ontick(() => {
    console.log(`job3 tick with crop ${job3.cron().cron}`)
    job3.stop()
})
const job3_started = job3.start()
console.log(`job3 started? - ${job3_started}`)



//'0 */5 * * * *'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const app = lib.create(error => {
    if (error) {
        console.warn('ERROR IN CREATE DB')
        console.warn(error)
        process.exit()
    }
})

function servers_ping(servers: server.Server[], idx: number, callback: () => void) {
    if (idx >= servers.length) {
        callback()
        return
    }
    servers[idx].ping(true, () => {
        idx++
        servers_ping(servers, idx, callback)
    })
}