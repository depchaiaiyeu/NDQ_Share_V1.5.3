import { removeMention } from "../../utils/format-util.js";
import { sendMessageFromSQL } from "../chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../service.js";
import { createCanvas, loadImage } from "canvas";
import fs from "fs";
import path from "path";
import { deleteFile } from "../../utils/util.js";
import { MessageMention } from "../../api-zalo/index.js";
import { getUserInfoData } from "./user-info.js";
import { getQRLinkFactory } from "../../api-zalo/factories/qr-link.js"; // <-- Import hàm mới

/**
 * Vẽ QR Zalo cùng thông tin user
 */
async function createQRUserImage(userInfo, qrUrl, description = "") {
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    try {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, "#283593");
        gradient.addColorStop(1, "#1565c0");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Load QR code
        const qrImage = await loadImage(qrUrl);
        const qrSize = 300;
        ctx.drawImage(qrImage, 50, (height - qrSize) / 2, qrSize, qrSize);

        // Vẽ avatar tròn (optional)
        try {
            const avatar = await loadImage(userInfo.avatar);
            const avatarSize = 80;
            ctx.save();
            ctx.beginPath();
            ctx.arc(width - avatarSize - 40, 100, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, width - avatarSize - 40, 60, avatarSize, avatarSize);
            ctx.restore();
        } catch (e) {
            console.warn("Không load được avatar:", e.message);
        }

        // Vẽ tên user
        ctx.font = "bold 40px Arial";
        ctx.fillStyle = "#fff";
        ctx.fillText(`Tên: ${userInfo.name}`, 400, 200);

        // Vẽ UID
        ctx.font = "30px Arial";
        ctx.fillText(`UID: ${userInfo.uid}`, 400, 260);

        // Vẽ nội dung
        if (description) {
            ctx.font = "28px Arial";
            ctx.fillStyle = "#ffeb3b";
            ctx.fillText(`Nội dung: ${description}`, 400, 330);
        }

        // Save ảnh ra file
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

/**
 * Xử lý lệnh qruser
 */
export async function handleQRUserCommand(api, message, aliasCommand) {
    const prefixGlobal = getGlobalPrefix();
    const content = removeMention(message);
    const senderName = message.data.dName;
    const senderId = message.data.uidFrom;

    let stringCommand = content.replace(`${prefixGlobal}${aliasCommand}`, "").trim();
    let imagePath = "";

    try {
        // Lấy user info + QR Link
        const userInfo = await getUserInfoData(api, senderId);
        const getQRLink = getQRLinkFactory(api);
        const qrResult = await getQRLink(senderId);

        if (!qrResult || !qrResult.qrInfos || !qrResult.qrInfos[0].qrLink) {
            await sendMessageFromSQL(api, message, {
                success: false,
                message: "Không thể lấy QR Zalo của bạn."
            }, true, 15000);
            return;
        }

        const qrUrl = qrResult.qrInfos[0].qrLink;

        // Tạo ảnh QR + thông tin
        imagePath = await createQRUserImage(userInfo, qrUrl, stringCommand);

        if (!imagePath) {
            await sendMessageFromSQL(api, message, {
                success: false,
                message: "Đã xảy ra lỗi khi tạo ảnh QR User."
            }, true, 15000);
            return;
        }

        // Gửi ảnh QR User
        await api.sendMessage({
            msg: `${senderName} đây là QR Zalo của bạn!`,
            attachments: [imagePath],
            mentions: [MessageMention(senderId, senderName.length, 0)]
        }, message.threadId, message.type);

    } catch (error) {
        console.error("Lỗi khi xử lý lệnh qruser:", error);
        await sendMessageFromSQL(api, message, {
            success: false,
            message: "Đã xảy ra lỗi khi xử lý lệnh qruser."
        }, true, 15000);
    } finally {
        if (imagePath) {
            await deleteFile(imagePath);
        }
    }
}
