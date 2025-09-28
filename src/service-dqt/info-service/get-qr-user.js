import { removeMention } from "../../utils/format-util.js";
import { sendMessageFromSQL } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import { deleteFile } from "../../utils/util.js";
import { MessageMention } from "../../api-zalo/index.js";
import { getUserInfoData } from "./user-info.js";

async function loadImageWithRetry(url, maxRetries = 3, timeout = 10000) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                timeout: timeout
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const buffer = await response.arrayBuffer();
            clearTimeout(timeoutId);

            return await loadImage(Buffer.from(buffer));
        } catch (error) {
            lastError = error;
            console.error(`Lần thử ${i + 1} thất bại:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw lastError;
}

async function createQRUserCardImage(qrCodeUrl, userInfo, content = "") {
    const width = 1000;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
        let backgroundImage;
        try {
            backgroundImage = await loadImageWithRetry(userInfo.avatar);
            ctx.filter = 'blur(8px)';
            ctx.drawImage(backgroundImage, 0, 0, width, height);
            ctx.filter = 'none';
        } catch (error) {
            console.error("Lỗi khi load avatar:", error);
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            gradient.addColorStop(0, "#1a237e");
            gradient.addColorStop(1, "#0d47a1");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
        }

        const overlay = ctx.createLinearGradient(0, 0, width, height);
        overlay.addColorStop(0, "rgba(26, 35, 126, 0.3)");
        overlay.addColorStop(1, "rgba(13, 71, 161, 0.3)");
        ctx.fillStyle = overlay;
        ctx.fillRect(0, 0, width, height);

        const qrImage = await loadImageWithRetry(qrCodeUrl);

        const qrSize = 300;
        const qrPadding = 50;

        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrPadding - 10, (height - qrSize) / 2 - 10, qrSize + 20, qrSize + 20);
        ctx.restore();

        ctx.drawImage(qrImage, qrPadding, (height - qrSize) / 2, qrSize, qrSize);

        ctx.beginPath();
        ctx.moveTo(qrSize + qrPadding * 2, 50);
        ctx.lineTo(qrSize + qrPadding * 2, height - 50);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = "left";
        const infoX = qrSize + qrPadding * 3;
        let infoY = 82;
        const lineHeight = 50;

        const textGradient = ctx.createLinearGradient(infoX, 0, width - 50, 0);
        textGradient.addColorStop(0, "#ffd700");
        textGradient.addColorStop(1, "#ffeb3b");

        ctx.font = "bold 32px BeVietnamPro";
        ctx.fillStyle = textGradient;
        ctx.fillText("QR NGƯỜI DÙNG", infoX, infoY);
        infoY += lineHeight;

        ctx.font = "bold 28px BeVietnamPro";
        ctx.fillStyle = "#ffffff";

        const fields = [
            { label: "Tên:", value: userInfo.displayName || userInfo.name || "Không rõ" },
            { label: "Nội dung:", value: content || "Không có" }
        ];

        fields.forEach(field => {
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.fillText(field.label, infoX, infoY);

            const labelWidth = ctx.measureText(field.label).width;
            ctx.fillStyle = "#ffffff";
            let displayValue = field.value;
            
            if (field.label === "Nội dung:" && field.value.length > 30) {
                displayValue = field.value.substring(0, 30) + '...';
            }
            
            ctx.fillText(displayValue, infoX + labelWidth + 15, infoY);
            infoY += lineHeight;
        });

        const filePath = path.resolve(`./assets/temp/qr_user_${Date.now()}.png`);
        const out = fs.createWriteStream(filePath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        return new Promise((resolve, reject) => {
            out.on("finish", () => resolve(filePath));
            out.on("error", reject);
        });
    } catch (error) {
        console.error("Lỗi khi tạo ảnh QR user:", error);
        return null;
    }
}

export async function getQRUser(api, message, aliasCommand) {
    const prefixGlobal = getGlobalPrefix();
    const content = removeMention(message);
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;
    let stringCommand = content.replace(`${prefixGlobal}${aliasCommand}`, "").trim();
    let imagePath = "";
    
    try {
        const targetUserId = message.data.mentions?.length > 0
            ? message.data.mentions.map((mention) => mention.uid)
            : [senderId];

        const targetUserName = message.data.mentions?.length > 0
            ? message.data.mentions.map((mention) => mention.displayName)
            : [senderName];

        for (let i = 0; i < targetUserId.length; i++) {
            const userId = targetUserId[i];
            const userName = targetUserName[i];

            try {
                const qrData = await api.getQRLink(userId);
                const qrLink = qrData[userId.toString()];
                
                if (!qrLink) {
                    const result = {
                        success: false,
                        message: "Không thể lấy QR code cho người dùng này."
                    };
                    await sendMessageFromSQL(api, message, result, false, 15000);
                    continue;
                }

                const userInfo = await getUserInfoData(api, userId);
                
                imagePath = await createQRUserCardImage(qrLink, userInfo, stringCommand);

                if (!imagePath) {
                    const result = {
                        success: false,
                        message: "Đã xảy ra lỗi khi tạo ảnh QR."
                    };
                    await sendMessageFromSQL(api, message, result, true, 15000);
                    continue;
                }

                await api.sendMessage({
                    msg: `${userName} đây là QR code của bạn!`,
                    attachments: [imagePath],
                    mentions: [MessageMention(userId, userName.length, 0)]
                }, message.threadId, message.type);

            } catch (error) {
                console.error("Lỗi khi lấy QR:", error);
                const result = {
                    success: false,
                    message: `Đã xảy ra lỗi khi lấy QR: ${error.message}`
                };
                await sendMessageFromSQL(api, message, result, true, 15000);
            } finally {
                if (imagePath) {
                    await deleteFile(imagePath);
                    imagePath = "";
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi xử lý lệnh QR user:", error);
        const result = {
            success: false,
            message: `Đã xảy ra lỗi khi xử lý QR user.`
        };
        await sendMessageFromSQL(api, message, result, true, 15000);
    } finally {
        if (imagePath) {
            await deleteFile(imagePath);
        }
    }
    }
