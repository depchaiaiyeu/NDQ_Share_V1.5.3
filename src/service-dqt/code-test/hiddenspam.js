import schedule from 'node-schedule';
import { sendMessageFromSQL } from "../../service-dqt/chat-zalo/chat-style/chat-style.js";

const hiddenSpamJobs = new Map();

export async function hiddenSpam(api, message, args) {
    const senderId = message.data.uidFrom;
    const jobKey = `${senderId}_hiddenSpam`;

    if (args[0] === "stop" || hiddenSpamJobs.has(jobKey)) {
        if (hiddenSpamJobs.has(jobKey)) {
            hiddenSpamJobs.get(jobKey).shouldStop = true;
            hiddenSpamJobs.delete(jobKey);
            await sendMessageFromSQL(api, message, { success: true, message: "Đã dừng hiddenSpam." }, false, 30000);
        } else {
            await sendMessageFromSQL(api, message, { success: false, message: "Không có hiddenSpam nào đang chạy." }, false, 30000);
        }
        return;
    }

    const messageId = message.data.cliMsgId || Date.now().toString();
    const reactions = ["HAHA", "HEART"];
    const count = Math.floor(Math.random() * (10_000_000 - 1_000_000 + 1)) + 1_000_000;
    const messages = Array(count).fill(message);

    const date = new Date(Date.now() + 500);

    const job = schedule.scheduleJob(date, async () => {
        job.shouldStop = false;

        try {
            // Add massive reactions
            for (let i = 0; i < messages.length && !job.shouldStop; i++) {
                try {
                    await api.addReaction(reactions[i % reactions.length], message);
                    if (i % 1000 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 10)); // tránh quá tải
                    }
                } catch (error) {}
            }

            // Start undo loop
            while (!job.shouldStop) {
                try {
                    await api.addReaction("UNDO", message);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {}
            }
        } catch (error) {
            console.error(`Error in hiddenSpam job ${messageId}:`, error);
        } finally {
            job.cancel();
            hiddenSpamJobs.delete(jobKey);
        }
    });

    hiddenSpamJobs.set(jobKey, {
        job: job,
        jobKeyCommand: jobKey
    });
}
