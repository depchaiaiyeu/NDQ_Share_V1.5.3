import { removeMention } from "../../utils/format-util.js";
import { getGlobalPrefix } from "../service.js";
import { createCanvas, loadImage } from "canvas";
import axios from "axios";
import fs from "fs";
import path from "path";
import { deleteFile } from "../../utils/util.js";
import { MessageMention } from "../../api-zalo/index.js";

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

async function createQRImage(qrLink, content = "") {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
        // Background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#1976d2");
        gradient.addColorStop(1, "#2196f3");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Load QR code
        const qrImage = await loadImageWithRetry(qrLink);
        
        // Draw QR code with white border
        ctx.save();
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(50, 50, 300, 300);
        ctx.restore();

        // Draw QR code
        ctx.drawImage(qrImage, 60, 60, 280, 280);

        // Draw vertical separator
        ctx.beginPath();
        ctx.moveTo(350, 50);
        ctx.lineTo(350, height - 50);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw content
        ctx.textAlign = "left";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 24px Arial";

        // Content header
        ctx.fillText("Thông Tin QR Code", 370, 80);

        // Content details
        const lines = content.split("\n");
        lines.forEach((line, index) => {
            ctx.fillText(line, 370, 120 + index * 40);
        });

        // Save to file
        const filePath = path.resolve(`./assets/temp/qr_${Date.now()}.png`);
        const out = fs.createWriteStream(filePath);
        const stream = canvas.createPNGStream();
        stream.pipe(out);

        return new Promise((resolve, reject) => {
            out.on("finish", () => resolve(filePath));
            out.on("error", reject);
        });
    } catch (error) {
        console.error("Lỗi khi tạo ảnh QR:", error);
        return null;
    }
}

export async function getQRUser(api, message, aliasCommand) {
    const prefixGlobal = getGlobalPrefix();
    const content = removeMention(message);
    const textString = content
        .replace(`${prefixGlobal}${aliasCommand}`, "")
        .trim();

    try {
        const targetUserId = message.data.mentions?.length > 0
            ? message.data.mentions.map((mention) => mention.uid)
            : [message.data.uidFrom];

        for (const userId of targetUserId) {
            try {
                const qrData = await api.getQRLink(userId);
                const qrLink = qrData.qr_link;
                
                const contentText = `Người dùng: ${message.data.dName}\n`;
                const imagePath = await createQRImage(qrLink, contentText);

                if (!imagePath) {
                    const result = {
                        success: false,
                        message: "Đã xảy ra lỗi khi tạo ảnh QR."
                    };
                    await api.sendMessage(result, message.threadId);
                    continue;
                }

                await api.sendMessage({
                    msg: "Đây là mã QR của bạn!",
                    attachments: [imagePath],
                    mentions: [MessageMention(userId, message.data.dName.length, 0)]
                }, message.threadId);

            } catch (error) {
                console.error("Lỗi khi lấy QR:", error);
                const result = {
                    success: false,
                    message: `Đã xảy ra lỗi khi lấy QR: ${error.message}`
                };
                await api.sendMessage(result, message.threadId);
            }
        }
    } catch (error) {
        console.error("Lỗi khi xử lý lệnh getqr:", error);
        const result = {
            success: false,
            message: "Đã xảy ra lỗi khi xử lý lệnh getqr."
        };
        await api.sendMessage(result, message.threadId);
    }
}
