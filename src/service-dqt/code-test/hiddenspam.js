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

    const spamMessage = await api.sendMessage("1P tưởng niệm bắt đầu...", message.thread_id);
    const reactions = ["HAHA", "HEART"];
    let index = 0;
    const job = { shouldStop: false };

    hiddenSpamJobs.set(jobKey, job);

    (async function loop() {
        while (!job.shouldStop) {
            try {
                await api.undoMessage(spamMessage);
                await api.addReaction(reactions[index % reactions.length], spamMessage);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await api.addReaction("UNDO", spamMessage);
                index++;
            } catch (error) {}
        }
        hiddenSpamJobs.delete(jobKey);
    })();
}
