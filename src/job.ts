import * as vvs from 'vv-shared'
import * as schedule from 'node-schedule'

export type TypeStorage = {
    kind: 'cron',
    cron: string
} | {
    kind: 'scheduler',
    weekday_sun: boolean,
    weekday_mon: boolean,
    weekday_tue: boolean,
    weekday_wed: boolean,
    weekday_thu: boolean,
    weekday_fri: boolean,
    weekday_sat: boolean,
    period_minutes: number,
    periodicity: 'every' | 'once'
}

export class Job {
    readonly storage: TypeStorage

    constructor(storage: TypeStorage) {
        if (storage.kind === 'cron') {
            this.storage = {
                kind: 'cron',
                cron: vvs.isEmptyString(storage.cron) ? '* * * * * *' : storage.cron
            }
        } else if (storage.kind === 'scheduler') {
            this.storage = {
                kind: 'scheduler',
                weekday_sun: vvs.isEmpty(storage.weekday_sun) ? false : storage.weekday_sun,
                weekday_mon: vvs.isEmpty(storage.weekday_mon) ? false : storage.weekday_mon,
                weekday_tue: vvs.isEmpty(storage.weekday_tue) ? false : storage.weekday_tue,
                weekday_wed: vvs.isEmpty(storage.weekday_wed) ? false : storage.weekday_wed,
                weekday_thu: vvs.isEmpty(storage.weekday_thu) ? false : storage.weekday_thu,
                weekday_fri: vvs.isEmpty(storage.weekday_fri) ? false : storage.weekday_fri,
                weekday_sat: vvs.isEmpty(storage.weekday_sat) ? false : storage.weekday_sat,
                period_minutes: vvs.isEmpty(storage.period_minutes) || storage.period_minutes < 1 || storage.period_minutes > 1439 ? 60 : storage.period_minutes,
                periodicity: storage.periodicity === 'every' || storage.periodicity === 'once' ? storage.periodicity : 'every'
            }
        }
    }

    cron() : {cron: string, native: boolean} {
        if (this.storage.kind === 'cron') {
            return {cron: this.storage.cron, native: true}
        }

        const second = '0'
        let minute = '*'
        let hour = '*'
        const day_of_month = '*'
        const month = '*'
        let day_of_week = '*'

        if (this.storage.periodicity === 'every') {
            minute = `*/${this.storage.period_minutes}`
        } else {
            const h = Math.floor(this.storage.period_minutes / 60)
            minute = `${this.storage.period_minutes - (h * 60)}`
            hour = `${h}`
        }

        const day_of_week_list = [
            this.storage.weekday_sun === true ? 0 : undefined,
            this.storage.weekday_mon === true ? 1 : undefined,
            this.storage.weekday_tue === true ? 2 : undefined,
            this.storage.weekday_wed === true ? 3 : undefined,
            this.storage.weekday_thu === true ? 4 : undefined,
            this.storage.weekday_fri === true ? 5 : undefined,
            this.storage.weekday_sat === true ? 6 : undefined,
        ].filter(f => !vvs.isEmpty(f))
        if (day_of_week_list.length < 7) {
            day_of_week = day_of_week_list.join(',')
        }

        return {cron: `${second} ${minute} ${hour} ${day_of_month} ${month} ${day_of_week}`, native: false}
    }

    start() {
        const job = schedule.scheduleJob('* * * * *', function(){
            console.log('The answer to life, the universe, and everything!');
        })
    }

    stop() {

    }
}