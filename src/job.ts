export type TypeTiming =
    {
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
        period_minutes: boolean,
        periodicity: 'every' | 'once'
    }

export class Job {


    constructor() {

    }
}