const socket = io();

let groupSettings = {};
let selectedGroups = {};
let selectedFriends = {};
let currentListType = "group";
let isBulkMessageActive = false;

document.addEventListener("DOMContentLoaded", () => {
    const tickerContent = document.querySelector(".ticker-content");
    const groupList = document.querySelector(".group-list");
    const friendList = document.querySelector(".friend-list");
    const listTitle = document.querySelector(".list-title");
    const groupsBtn = document.getElementById("groupsBtn");
    const friendsBtn = document.getElementById("friendsBtn");
    const selectAllBtn = document.getElementById("selectAllBtn");
    const unselectAllBtn = document.getElementById("unselectAllBtn");
    const selectedCountSpan = document.querySelector(".selected-count");
    const refreshBtn = document.getElementById("refreshBtn");
    const messageContent = document.getElementById("messageContent");
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const sendToFriends = document.getElementById("sendToFriends");
    const sendToGroups = document.getElementById("sendToGroups");
    const timeValue = document.getElementById("timeValue");
    const timeUnit = document.getElementById("timeUnit");
    const sendForSelected = document.getElementById("sendForSelected");
    const sendBulkMessage = document.getElementById("sendBulkMessage");

    socket.emit("getAllGroups");
    socket.emit("getAllFriends");

    socket.on("friendsList", (friends) => {
        displayList("friend", friends);
        updateSelectedCount();
    });

    socket.on("groupsList", (groups) => {
        displayList("group", groups);
        updateSelectedCount();
    });

    socket.on("newMessage", (messageData) => {
        updateTicker(messageData);
        updateLogs(messageData);
    });

    groupsBtn.addEventListener("click", () => {
        groupList.style.display = "block";
        friendList.style.display = "none";
        listTitle.textContent = "Danh sách nhóm";
        groupsBtn.classList.add("active");
        friendsBtn.classList.remove("active");
        currentListType = "group";
        updateSelectedCount();
    });

    friendsBtn.addEventListener("click", () => {
        groupList.style.display = "none";
        friendList.style.display = "block";
        listTitle.textContent = "Danh sách bạn bè";
        friendsBtn.classList.add("active");
        groupsBtn.classList.remove("active");
        currentListType = "friend";
        updateSelectedCount();
    });

    refreshBtn.addEventListener("click", () => {
        if (currentListType === "group") {
            socket.emit("getAllGroups");
        } else {
            socket.emit("getAllFriends");
        }
    });

    function updateSelectedCount() {
        const groupCount = Object.keys(selectedGroups).length;
        const friendCount = Object.keys(selectedFriends).length;
        selectedCountSpan.textContent = `Đã Chọn: ${groupCount} Nhóm - ${friendCount} Bạn bè`;
    }

    function displayList(type, items) {
        const container = type === "group" ? groupList : friendList;
        container.innerHTML = "";
        items.forEach((item) => {
            const div = document.createElement("div");
            div.className = `${type}-item`;
            const id = item.groupId || item.userId;
            const isChecked = type === "group" ? selectedGroups[id] : selectedFriends[id];
            
            div.innerHTML = `
                <div class="item-info">
                    ${type === "group" ? `<i class="fas fa-cog settings-icon" data-id="${id}" data-name="${item.name || item.zaloName}"></i>` : ''}
                    <img src="${item.avatar || item.avt}" class="avatar" alt="Avatar">
                    <div class="item-details">
                        <div class="item-name">${item.name || item.zaloName}</div>
                        ${type === "group" ? `<div class="item-number-member">${item.memberCount} thành viên</div>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <button class="send-btn" data-id="${id}" data-type="${type}">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                    <input type="checkbox" class="item-checkbox" data-id="${id}" data-type="${type}" 
                           data-name="${item.name || item.zaloName}" ${isChecked ? "checked" : ""}>
                </div>
            `;

            if (type === "group") {
                const settingsIcon = div.querySelector(".settings-icon");
                settingsIcon.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const groupId = e.target.dataset.id;
                    const groupName = e.target.dataset.name;
                    showSettingsModal(groupId, groupName);
                });
            }

            const checkbox = div.querySelector(".item-checkbox");
            checkbox.addEventListener("change", (e) => {
                const id = e.target.dataset.id;
                const itemType = e.target.dataset.type;
                const name = e.target.dataset.name;
                if (e.target.checked) {
                    if (itemType === "group") {
                        selectedGroups[id] = { name: name };
                    } else {
                        selectedFriends[id] = { name: name };
                    }
                } else {
                    if (itemType === "group") {
                        delete selectedGroups[id];
                    } else {
                        delete selectedFriends[id];
                    }
                }
                updateSelectedCount();
            });

            const sendBtn = div.querySelector(".send-btn");
            sendBtn.addEventListener("click", async () => {
                const message = messageContent.value;
                const files = fileInput.files;
                const filePaths = await uploadFiles(files);
                const delay = calculateDelay();

                socket.emit("sendMessageToSingle", {
                    id,
                    type,
                    message,
                    filePaths,
                    delay,
                });
            });

            container.appendChild(div);
        });
        updateSelectedCount();
    }

    selectAllBtn.addEventListener("click", () => {
        const selector = currentListType === "group" 
            ? ".group-list .item-checkbox" 
            : ".friend-list .item-checkbox";
        document.querySelectorAll(selector).forEach((checkbox) => {
            checkbox.checked = true;
            const id = checkbox.dataset.id;
            if (currentListType === "group") {
                selectedGroups[id] = true;
            } else {
                selectedFriends[id] = true;
            }
        });
        updateSelectedCount();
    });

    unselectAllBtn.addEventListener("click", () => {
        const selector = currentListType === "group" 
            ? ".group-list .item-checkbox" 
            : ".friend-list .item-checkbox";
        document.querySelectorAll(selector).forEach((checkbox) => {
            checkbox.checked = false;
        });
        if (currentListType === "group") {
            selectedGroups = {};
        } else {
            selectedFriends = {};
        }
        updateSelectedCount();
    });

    function updateSelected() {
        socket.emit("updateSelected", {
            groups: selectedGroups,
            friends: selectedFriends,
        });
    }

    function updateTicker(messageData) {
        const tickerContent = document.querySelector(".ticker-content");
        const { nameType, senderName, content } = messageData;
        const contentText = typeof content === "string" 
            ? content 
            : content.title 
                ? content.title 
                : content.catId 
                    ? "Sticker" 
                    : JSON.stringify(content);
        
        tickerContent.textContent = `< ${nameType} > ${senderName}: ${contentText}`;
        tickerContent.style.animation = "none";
        tickerContent.offsetHeight;
        tickerContent.style.animation = null;
    }

    function updateLogs(messageData) {
        const logContent = document.querySelector(".log-content");
        const logEntry = document.createElement("div");
        logEntry.className = "log-entry";
        
        const isScrolledToBottom = logContent.scrollHeight - logContent.clientHeight - logContent.scrollTop <= 100;
        
        const timestamp = new Date().toLocaleTimeString();
        const { nameType, senderName, content, avtGroup } = messageData;
        
        const contentText = typeof content === "string" 
            ? content 
            : content.href 
                ? `Caption: ${content.title}\nLink: ${content.href}` 
                : content.catId 
                    ? `Sticker ID: ${content.catId}` 
                    : JSON.stringify(content);

        logEntry.innerHTML = `
            <div class="log-icon-container">
                <img src="${avtGroup}" alt="Group Avatar" class="avatar">
            </div>
            <div class="log-content-container">
                <div class="log-header">
                    <span class="log-type">${nameType}</span>
                    <span class="log-time">[${timestamp}]</span>
                </div>
                <span class="log-message">${senderName}: ${contentText}</span>
            </div>
        `;

        logContent.appendChild(logEntry);
        if (isScrolledToBottom) {
            requestAnimationFrame(() => {
                logContent.scrollTop = logContent.scrollHeight;
            });
        }
    }

    function showSettingsModal(groupId, groupName) {
        const modal = document.getElementById("settingsModal");
        const settingsGrid = document.getElementById("settingsGrid");
        const settings = groupSettings[groupId];

        if (!settings) {
            console.error("Không tìm thấy cài đặt cho nhóm:", groupId);
            return;
        }

        const settingsList = {
            activeBot: "Tương tác với thành viên",
            activeGame: "bật xử lý tương tác trò chơi",
            antiSpam: "Chống spam",
            removeLinks: "Chặn liên kết",
            filterBadWords: "Xoá tin nhắn thô tục",
            welcomeGroup: "Chào thành viên mới",
            byeGroup: "Báo thành viên rời nhóm",
            learnEnabled: "Học máy",
            replyEnabled: "Trả lời tin nhắn nhóm",
            onlyText: "Chỉ được nhắn tin văn bản",
            memberApprove: "Phê duyệt thành viên mới",
            antiNude: "Chống gửi ảnh nhạy cảm",
            antiUndo: "Chống thu hồi tin nhắn",
            sendTask: "Gửi nội dung tự động",
        };

        settingsGrid.innerHTML = Object.entries(settingsList)
            .map(([key, label]) => `
                <div class="setting-item">
                    <span>${label}</span>
                    <label class="switch">
                        <input type="checkbox" class="setting-toggle" 
                               data-setting="${key}" 
                               data-group-id="${groupId}" 
                               ${settings[key] ? "checked" : ""}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `).join("");

        settingsGrid.querySelectorAll(".setting-toggle").forEach((toggle) => {
            toggle.addEventListener("change", (e) => {
                const command = e.target.dataset.setting;
                const groupId = e.target.dataset.groupId;
                const isEnabled = e.target.checked;

                socket.emit("updateFutureStatus", {
                    groupId,
                    groupName,
                    command,
                    isActive: isEnabled,
                });
            });
        });

        modal.style.display = "block";
        const closeBtn = modal.querySelector(".close-modal");
        closeBtn.onclick = () => modal.style.display = "none";
        window.onclick = (e) => {
            if (e.target === modal) modal.style.display = "none";
        };
    }

    fileInput.addEventListener("change", updateFileList);

    function updateFileList() {
        fileList.innerHTML = "";
        Array.from(fileInput.files).forEach((file, index) => {
            const fileItem = document.createElement("div");
            fileItem.className = "file-item";
            fileItem.innerHTML = `
                <span>${file.name}</span>
                <button onclick="removeFile(${index})">Xóa</button>
            `;
            fileList.appendChild(fileItem);
        });
    }

    window.removeFile = function(index) {
        const dt = new DataTransfer();
        const { files } = fileInput;
        for (let i = 0; i < files.length; i++) {
            if (i !== index) dt.items.add(files[i]);
        }
        fileInput.files = dt.files;
        updateFileList();
    };

    sendToFriends.addEventListener("click", () => {
        if (checkContentAndAttachments()) {
            showConfirmDialog(
                "Xác nhận",
                "Bạn có chắc chắn muốn gửi tin nhắn đến tất cả bạn bè?",
                () => sendMessage("DirectMessage")
            );
        }
    });

    sendToGroups.addEventListener("click", () => {
        if (checkContentAndAttachments()) {
            showConfirmDialog(
                "Xác nhận",
                "Bạn có chắc chắn muốn gửi tin nhắn đến tất cả nhóm?",
                () => sendMessage("GroupMessage")
            );
        }
    });

    sendForSelected.addEventListener("click", () => {
        if (checkContentAndAttachments()) {
            showConfirmDialog(
                "Xác nhận",
                "Bạn có chắc chắn muốn gửi tin nhắn đến các mục đã chọn?",
                () => sendMessageForSelected()
            );
        }
    });

    sendBulkMessage.addEventListener("click", () => {
        if (checkContentAndAttachments()) {
            if (!isBulkMessageActive) {
                showConfirmDialog(
                    "Xác nhận",
                    "Bạn có chắc chắn muốn bắt đầu gửi tin nhắn liên tục?",
                    () => sendBulkMessageForSelected()
                );
            } else {
                showConfirmDialog(
                    "Xác nhận",
                    "Bạn có chắc chắn muốn dừng gửi tin nhắn liên tục?",
                    () => sendBulkMessageForSelected()
                );
            }
        }
    });

    socket.on("bulkMessageStatus", (status) => {
        if (status === "stopped") {
            sendBulkMessage.textContent = "Gửi liên tục cho các đối tượng đã chọn";
            sendBulkMessage.style.backgroundColor = "";
            sendBulkMessage.style.color = "";
            isBulkMessageActive = false;
        }
    });

    async function uploadFiles(files) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i], files[i].name);
        }

        try {
            const response = await fetch("/upload", {
                method: "POST",
                body: formData,
            });
            const result = await response.json();
            return result.filePaths;
        } catch (error) {
            console.error("Lỗi khi tải file:", error);
            return [];
        }
    }

    async function sendMessage(messageType) {
        const message = messageContent.value;
        const files = fileInput.files;
        const delay = calculateDelay();
        const filePaths = await uploadFiles(files);

        socket.emit("sendMessageAll", {
            message,
            messageType,
            delay,
        });
    }

    async function sendMessageForSelected() {
        const message = messageContent.value;
        const files = fileInput.files;
        const filePaths = await uploadFiles(files);
        const delay = calculateDelay();

        socket.emit("sendMessageForSelected", {
            message,
            delay,
        });
    }

    async function sendBulkMessageForSelected() {
        if (!isBulkMessageActive) {
            const delay = calculateDelay();

            if (isNaN(delay) || delay <= 0) {
                showPopupNotification(
                    "Yêu Cầu Bổ Sung",
                    "Bạn phải nhập số giây delay hợp lệ"
                );
                return;
            }

            const message = messageContent.value;
            const filePaths = await uploadFiles(fileInput.files);

            socket.emit("startBulkMessage", {
                content: message,
                interval: delay,
                filePaths: filePaths,
            });

            sendBulkMessage.textContent = "Dừng gửi liên tục";
            sendBulkMessage.style.backgroundColor = "red";
            sendBulkMessage.style.color = "white";
            isBulkMessageActive = true;
        } else {
            socket.emit("stopBulkMessage");
            sendBulkMessage.textContent = "Gửi liên tục cho các đối tượng đã chọn";
            sendBulkMessage.style.backgroundColor = "";
            sendBulkMessage.style.color = "";
            isBulkMessageActive = false;
        }
    }

    function calculateDelay() {
        const value = parseInt(timeValue.value);
        const unit = timeUnit.value;
        let delay = value;

        switch (unit) {
            case "minutes":
                delay *= 60;
                break;
            case "hours":
                delay *= 3600;
                break;
            case "days":
                delay *= 86400;
                break;
        }

        return delay * 1000;
    }

    function checkContentAndAttachments() {
        const content = messageContent.value.trim();
        const hasAttachments = fileInput.files.length > 0;

        if (!content && !hasAttachments) {
            showPopupNotification(
                "Thông báo",
                "Vui lòng nhập nội dung hoặc chọn file đính kèm."
            );
            return false;
        }
        return true;
    }

    function showPopupNotification(title, message) {
        const popup = document.getElementById("popupNotification");
        const popupTitle = document.getElementById("popupTitle");
        const popupMessage = document.getElementById("popupMessage");
        
        popupTitle.textContent = title;
        popupMessage.textContent = message;
        popup.style.display = "block";
    }

    function showConfirmDialog(title, message, onConfirm) {
        const confirmDialog = document.getElementById("confirmDialog");
        const confirmTitle = document.getElementById("confirmTitle");
        const confirmMessage = document.getElementById("confirmMessage");
        const confirmYes = document.getElementById("confirmYes");
        
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmDialog.style.display = "block";
        
        confirmYes.onclick = () => {
            confirmDialog.style.display = "none";
            onConfirm();
        };
    }
});
