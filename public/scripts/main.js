const socket = io();
let selectedGroupId = null;
let selectedGroupName = null;

document.addEventListener("DOMContentLoaded", () => {
  const groupList = document.querySelector(".group-list");
  const chatHeader = document.getElementById("chatHeader");
  const chatContent = document.getElementById("chatContent");
  const messageInput = document.getElementById("messageInput");
  const sendMessageBtn = document.getElementById("sendMessageBtn");
  const popupNotification = document.getElementById("popupNotification");
  const popupTitle = document.getElementById("popupTitle");
  const popupMessage = document.getElementById("popupMessage");
  const closePopupNotification = document.getElementById("closePopupNotification");

  socket.emit("getAllGroups");

  socket.on("groupsList", (groups) => {
    groupList.innerHTML = "";
    groups.forEach((group) => {
      const div = document.createElement("div");
      div.className = "group-item";
      div.innerHTML = `
        <img src="${group.avatar || "/default-avatar.png"}" alt="Avatar">
        <div class="group-name">${group.name || group.zaloName}</div>
      `;
      div.addEventListener("click", () => {
        selectedGroupId = group.groupId;
        selectedGroupName = group.name || group.zaloName;
        chatHeader.textContent = selectedGroupName;
        socket.emit("getGroupMessages", { groupId: selectedGroupId });
        document.querySelectorAll(".group-item").forEach((item) => item.classList.remove("selected"));
        div.classList.add("selected");
      });
      groupList.appendChild(div);
    });
  });

  socket.on("groupMessages", (messages) => {
    chatContent.innerHTML = "";
    messages.forEach((msg) => {
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${msg.isSentByBot ? "sent" : "received"}`;
      const contentText = typeof msg.content === "string" ? msg.content : msg.content.title || "Sticker";
      messageDiv.innerHTML = `
        <div class="message-content">${contentText}</div>
        <div class="message-meta">${msg.senderName} · ${new Date().toLocaleTimeString()}</div>
      `;
      chatContent.appendChild(messageDiv);
    });
    chatContent.scrollTop = chatContent.scrollHeight;
  });

  socket.on("newMessage", (messageData) => {
    if (selectedGroupId && messageData.groupId === selectedGroupId) {
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${messageData.isSentByBot ? "sent" : "received"}`;
      const contentText = typeof messageData.content === "string" ? messageData.content : messageData.content.title || "Sticker";
      messageDiv.innerHTML = `
        <div class="message-content">${contentText}</div>
        <div class="message-meta">${messageData.senderName} · ${new Date().toLocaleTimeString()}</div>
      `;
      chatContent.appendChild(messageDiv);
      chatContent.scrollTop = chatContent.scrollHeight;
    }
  });

  sendMessageBtn.addEventListener("click", () => {
    const message = messageInput.value.trim();
    if (!selectedGroupId) {
      showPopupNotification("Lỗi", "Vui lòng chọn một nhóm trước khi gửi tin nhắn.");
      return;
    }
    if (!message) {
      showPopupNotification("Lỗi", "Vui lòng nhập nội dung tin nhắn.");
      return;
    }
    socket.emit("sendMessageToSingle", {
      id: selectedGroupId,
      type: "group",
      message,
      filePaths: [],
      delay: 0
    });
    messageInput.value = "";
  });

  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessageBtn.click();
    }
  });

  socket.on("messageSentToSingle", (response) => {
    if (response.success) {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message sent";
      messageDiv.innerHTML = `
        <div class="message-content">${response.message}</div>
        <div class="message-meta">Bot · ${new Date().toLocaleTimeString()}</div>
      `;
      chatContent.appendChild(messageDiv);
      chatContent.scrollTop = chatContent.scrollHeight;
    } else {
      showPopupNotification("Lỗi", `Không thể gửi tin nhắn: ${response.message}`);
    }
  });

  closePopupNotification.addEventListener("click", () => {
    popupNotification.style.display = "none";
  });

  function showPopupNotification(title, message) {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupNotification.style.display = "block";
    popupNotification.classList.add("fade-in");
    setTimeout(() => {
      popupNotification.classList.remove("fade-in");
      popupNotification.style.display = "none";
    }, 3000);
  }
});
