import { getUserInfoData } from "../../info-service/user-info.js";
import { isAdmin } from "../../../index.js";
import { getGlobalPrefix } from "../../service.js";
import { removeMention } from "../../../utils/format-util.js";

const scoldUsers = new Map();
let isScoldingActive = false;

export async function scoldUser(api, message) {
  const prefix = getGlobalPrefix();
  const senderId = message.data.uidFrom;
  const threadId = message.threadId;
  const content = removeMention(message);

  if (content.toLowerCase() === `${prefix}scold tha`) {
    if (isAdmin(senderId, threadId) && isScoldingActive) {
      isScoldingActive = false;
      api.sendMessage({ msg: "Dạ Đại Ca em sẽ tha cho nó.", quote: message }, threadId, message.type);
      return;
    }
  }

  let delay = 2000;
  const args = content.split(' ').filter(arg => arg !== '');
  const delayArg = args.find(arg => {
    const cleanArg = arg.toLowerCase().replace('ms', '');
    return !isNaN(cleanArg);
  });

  if (delayArg) {
    const cleanDelay = parseInt(delayArg.toLowerCase().replace('ms', ''));
    delay = cleanDelay;
    if (delay < 100) delay = 100;
    delay = Math.min(delay, 10000);
  }

  if (!isScoldingActive) {
    isScoldingActive = true;
  }

  if (!message.data.mentions || message.data.mentions.length === 0) {
    await api.sendMessage({ msg: ":D Đại Ca muốn em chửi ai? 🚀", quote: message }, threadId, message.type);
    return;
  }

  const userId = message.data.mentions[0].uid;

  if (isAdmin(userId, threadId)) {
    await api.sendMessage(
      { msg: "Không thể ra lệnh chửi quản trị bot. 🚫", quote: message },
      threadId,
      message.type
    );
    return;
  }

  if (scoldUsers.has(userId)) {
    await api.sendMessage(
      {
        msg: "Người này đang bị chửi.",
        quote: message,
      },
      threadId,
      message.type
    );
    return;
  }

  const scoldMessages = [
    "Bạn ra đây tao bảo, hiện hồn nhanh con chó",
    "Hiện hồn nhanh Không tao đốt nhà Bạn giờ",
    "Địt mẹ Bạn bố nói tử tế mà Không dậy à",
    "Nhanh ra chửi nhau với tao",
    "Tao ném trứng thối đổ dầu đổ xăng vào nhà Bạn giờ",
    "Hoá ra cũng chỉ là con chó mang hình dáng người",
    "Làm người thì khó, làm chó thì dễ ..!!",
    "Đừng tỏ vẻ máu liều nhiều hơn máu não",
    "Đụ con đĩ mẹ Bạn",
    "Con chó Bạn đứng lên đi",
    "Địt mẹ bố gọi Không nghe à",
    "Hiện hồn đi thằng mặt lồn",
    "Đĩ mẹ Bạn ra đây bô xem nào",
    "Tao ném trứng thối đổ dầu đổ xăng vào nhà Bạn giờ",
    "Bố Bạn bắn rap chết cụ Bạn giờ",
    "Vậy thì xin mời nghe tao rap địt chết cả lò Bạn nhà con",
    "Đầu tiên tao xin phép địt từ trên xuống dưới con",
    "Tao địt từ lỗ lồn đến lỗ nhị con lồn",
    "Lồn thì to như lồn trâu thủ dâm ống cống ấy nhé con",
    "Tao địt chắc 2 thằng như tao chưa đủ lấp cái lỗ lồn nhà Bạn đâu",
    "Đụ con đĩ mẹ Bạn",
    "Thằng óc cức",
    "Mẹ m đẻ m ra đau lồn chứ được con cặc gì",
    "Con mẹ Bạn đẻ m ra đau lồn chứ được con cặc gì",
    "...",
    "Tao địt mẹ Bạn đến mấy lần rồi con",
    "Tinh trùng khuyết tật",
    "Hồi đó ba Bạn Không dùng bao nên lòi ra thằng mặt cặc như Bạn đó",
    "Con mẹ Bạn",
    "Thằng lồn óc chó",
    "Thứ súc vật",
    "Tao là bố của mẹ Bạn",
    "Chửi chết con mẹ Bạn luôn",
    "Có giỏi thì bơi ra chửi tay đôi đi thằng lồn",
    "Bạn nghĩ gì mà động vào Đại Ca tao",
    "Loại rác rưỡi như Bạn thì Không có tuổi",
    "Bạn có phải con chó Không?",
    "Người Không thể ngu vậy được",
    "Cút con mẹ Bạn đi...",
    "Thứ lồn, đỉ mẹ Bạn",
    "Bạn động nhầm người rồi con chó ạ",
    "Bố Bạn chấp, thứ súc sinh đội lớp thú",
    "Chửi chết mẹ Bạn luôn",
    "Lần sau gặp Đại Ca tao thì né xa ra, địt mẹ Bạn"
  ];

  scoldUsers.set(userId, true);
  isScoldingActive = true;

  let count = 0;
  const interval = setInterval(async () => {
    if (!isScoldingActive) {
      const genderText = userTarget.genderId === 0 ? "Thằng Oắt Con" : userTarget.genderId === 1 ? "Oắc Con" : "Thằng Oắt Con";
      await api.sendMessage(
        {
          msg: `${genderText} ${userTarget.name}, nể Đại Ca của tao tha Bạn lần này, cảm ơn Đại Ca tao đi!`,
          mentions: [{ pos: genderText.length + 1, uid: userTarget.uid, len: userTarget.name.length }],
        },
        threadId,
        message.type
      );
      scoldUsers.delete(userId);
      clearInterval(interval);
      return;
    }

    if (count >= scoldMessages.length) {
      count = 0;
    }

    const randomMessage = scoldMessages[count];
    await api.sendMessage(
      {
        msg: `${userTarget.name} ${randomMessage}`,
        mentions: [{ pos: 0, uid: userTarget.uid, len: userTarget.name.length }],
      },
      threadId,
      message.type
    );
    count++;
  }, delay);

  const userTarget = await getUserInfoData(api, userId);
  const caption = `Tao chuẩn bị mắng yêu `;
  await api.sendMessage(
    {
      msg: caption + `${userTarget.name}!!`,
      mentions: [{ pos: caption.length, uid: userId, len: userTarget.name.length }],
    },
    threadId,
    message.type
  );
}
