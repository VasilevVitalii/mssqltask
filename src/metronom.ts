import * as vvs from 'vv-shared'
import * as schedule from 'node-schedule'

export type TypeMetronom = {
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

export class Metronom {
    readonly options: TypeMetronom
    private job: schedule.Job
    private callback_ontick: () => void

    constructor(options: TypeMetronom) {
        if (options.kind === 'cron') {
            this.options = {
                kind: 'cron',
                cron: vvs.isEmptyString(options.cron) ? '* * * * * *' : options.cron
            }
        } else if (options.kind === 'scheduler') {
            this.options = {
                kind: 'scheduler',
                weekday_sun: vvs.isEmpty(options.weekday_sun) ? false : options.weekday_sun,
                weekday_mon: vvs.isEmpty(options.weekday_mon) ? false : options.weekday_mon,
                weekday_tue: vvs.isEmpty(options.weekday_tue) ? false : options.weekday_tue,
                weekday_wed: vvs.isEmpty(options.weekday_wed) ? false : options.weekday_wed,
                weekday_thu: vvs.isEmpty(options.weekday_thu) ? false : options.weekday_thu,
                weekday_fri: vvs.isEmpty(options.weekday_fri) ? false : options.weekday_fri,
                weekday_sat: vvs.isEmpty(options.weekday_sat) ? false : options.weekday_sat,
                period_minutes: vvs.isEmpty(options.period_minutes) || options.period_minutes < 1 || options.period_minutes > 1439 ? 60 : options.period_minutes,
                periodicity: options.periodicity === 'every' || options.periodicity === 'once' ? options.periodicity : 'every'
            }
        }
    }

    cron() : {cron: string, native: boolean} {
        if (this.options.kind === 'cron') {
            return {cron: this.options.cron, native: true}
        }

        const second = '0'
        let minute = '*'
        let hour = '*'
        const day_of_month = '*'
        const month = '*'
        let day_of_week = '*'

        if (this.options.periodicity === 'every') {
            minute = `*/${this.options.period_minutes}`
        } else {
            const h = Math.floor(this.options.period_minutes / 60)
            minute = `${this.options.period_minutes - (h * 60)}`
            hour = `${h}`
        }

        const day_of_week_list = [
            this.options.weekday_sun === true ? 0 : undefined,
            this.options.weekday_mon === true ? 1 : undefined,
            this.options.weekday_tue === true ? 2 : undefined,
            this.options.weekday_wed === true ? 3 : undefined,
            this.options.weekday_thu === true ? 4 : undefined,
            this.options.weekday_fri === true ? 5 : undefined,
            this.options.weekday_sat === true ? 6 : undefined,
        ].filter(f => !vvs.isEmpty(f))
        if (day_of_week_list.length < 7) {
            day_of_week = day_of_week_list.join(',')
        }

        return {cron: `${second} ${minute} ${hour} ${day_of_month} ${month} ${day_of_week}`, native: false}
    }

    ontick(callback: () => void) {
        this.callback_ontick = callback
    }

    start(): boolean {
        if (this.job) return true
        const callback = this.callback_ontick
        this.job = schedule.scheduleJob(this.cron().cron, function(){
            if (!callback) return
            callback()
        })
        if (this.job === null) {
            this.job = undefined
            return false
        }
        return true
    }

    stop() {
        if (!this.job) return
        this.job.cancel()
        this.job = undefined
    }
}