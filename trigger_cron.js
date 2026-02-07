const Scheduler = require('./src/cron/scheduler');
const db = require('./src/config/database');

async function trigger() {
    console.log('Manually triggering cron...');
    try {
        await Scheduler.triggerManualRun();
        console.log('Cron triggered successfully');
    } catch (err) {
        console.error('Trigger failed:', err);
    } finally {
        process.exit();
    }
}

trigger();
