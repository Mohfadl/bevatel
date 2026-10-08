const API = '/api';
let token = localStorage.getItem('bevatel_token', );
let currentUserEmail =localStorage.getItem('bevatel_email',);
let conversations = [];
let channels = [];
let labels = [];
let selectedConversation = null;
let selectedChannelId = null;
let assignmentFilter = 'unassigned';
let sidebarFilter = 'all';
 
let socket = null;
let socketConnected = false;
let joinedConversationId = null;

const mediaObjectUrls = new Map();
const mediaRequests = new Map();


function element(id,) {
    return document.getElementById(id,);
}

function escapeHtml(value,) {
    const div = document.createElement('div',);
    div.textContent = value ?? '';
    return div.innerHTML;
}

function initials(name,) {
    const safeName = String(name ??'',).trim();
    if (!safeName) {
        return '?';
    }
    const parts = safeName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return parts[0].substring(0,2,).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDate(value,) {
    if (!value) {
        return '';
    }

    const date = new Date(value,);
    if (Number.isNaN(date.getTime(),)) {
        return '';
    }
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff /60000,);
    const hours = Math.floor(diff /3600000,);
    const days = Math.floor(diff /86400000,);
    if (minutes < 1) {
        return 'now';
    }

    if (minutes < 60) {
        return `${minutes}m`;
    }

    if (hours < 24) {
        return `${hours}h`;
    }

    if (days < 30) {
        return `${days}d`;
    }
    return date.toLocaleDateString();
}

function formatMessageTime(value,) {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    return date.toLocaleTimeString([],
            {
                hour: '2-digit',
                minute: '2-digit',
            },
        );
}

function toast(message,type ='') {
    const container = element('toast-container');
    const item =document.createElement('div');
    item.className = `toast ${type}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => {item.remove();},3500,);
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

async function api(url, options = {}) {
    if (!token) {
        throw new Error('Authentication token is missing');
    }

    const response = await fetch(
        `${API}${url}`,
        {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...(options.headers ?? {}),
            },
        },
    );

    let result = {}; 
    try {
        result = await response.json();
    } catch {
        result = {};
    }

    if (response.status === 401) {
        console.warn('Authentication failed:',url,result,);
        logout();
        throw new Error(result?.message ??'Your session has expired. Please login again.',);
    }

    if (!response.ok) {
        throw new Error(result?.message ??'Request failed',);
    }
    return result;
}

function extractCollection(result,key) 
{
    if (Array.isArray(result,)) {
        return result;
    }

    if (Array.isArray(result?.data,)) {
        return result.data;
    }

    if (Array.isArray(result?.[key],)) {
        return result[key];
    }

    if (Array.isArray(result?.data?.[key],)) {
        return result.data[key];
    }

    if (Array.isArray(result?.data?.data,)) {
        return result.data.data;
    }
    return [];
}
 
function connectSocket() {
    if (!token ||typeof io === 'undefined') {
        return;
    }

    if (socket) {
        socket.disconnect();
        socket = null;
    }
    socket =
        io({
            auth: {token},
            transports: ['websocket','polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

    socket.on('connect',() => {
            socketConnected = true;
            console.log('Realtime connected:',socket.id,);
            if (selectedConversation?.id) {
                joinConversationRoom(selectedConversation.id,);
            }
        },
    );

    socket.on('disconnect',reason => {
        socketConnected =false; 
        console.log('Realtime disconnected:',reason,);
    });
    socket.on('connect_error',error => {console.error('Realtime connection error:',error.message,);},);
    socket.on('conversation:joined',data => {joinedConversationId =data?.conversationId ??null;},);
    socket.on('message.created',message => {handleRealtimeMessage(message,);},);
    socket.on('message.updated', message => {handleRealtimeMessageUpdate(message);},);
}


function disconnectSocket() {
    if (!socket) {
        return;
    }

    if (joinedConversationId) {
        socket.emit('conversation:leave',joinedConversationId);
    }

    socket.disconnect();
    socket = null;
    socketConnected = false;
    joinedConversationId = null;
}


function joinConversationRoom(conversationId) {
    if (!socket ||!socket.connected ||!conversationId) {
        return;
    }

    if (joinedConversationId &&joinedConversationId !==conversationId) {
        socket.emit('conversation:leave',joinedConversationId,);
    }

    socket.emit('conversation:join',conversationId,);
    joinedConversationId = conversationId;
}


function messageAlreadyExists(messageId) {
    if (!messageId ||!selectedConversation) {
        return false;
    }
    const messages = selectedConversation.messages ?? [];
    return messages.some(message => message.id === messageId);
}

function handleRealtimeMessage(message) {
    if (!message ||!message.id ||!message.conversationId) {
        return;
    }
 
    if (selectedConversation?.id === message.conversationId) {
        if (!messageAlreadyExists(message.id)) {
            if (!Array.isArray(selectedConversation.messages)) {
                selectedConversation.messages = [];
            }

            selectedConversation.messages.push(message);
            selectedConversation.lastMessageAt = message.createdAt;
            renderMessages();
        }
    }

    const conversationIndex = conversations.findIndex(conversation => conversation.id === message.conversationId);
    if (conversationIndex >= 0) {
        const conversation = conversations[conversationIndex];
        conversation.lastMessageAt = message.createdAt;
        conversation.messages = [message,];
        conversations.splice(conversationIndex,1,);
        conversations.unshift(conversation,);
        updateConversationCounters();
        renderConversations();
        return;
    }

    loadConversations()
        .catch(
            error => {
                console.error('Failed to refresh conversations after realtime message:',error,);
            },
        );
}


function handleRealtimeMessageUpdate(updatedMessage) 
{
    if (!updatedMessage ||!updatedMessage.id ||!selectedConversation) {
        return;
    }
    const messages = selectedConversation.messages ?? [];
    const index = messages.findIndex(message =>message.id === updatedMessage.id);
    if (index < 0) {
        return;
    }
    messages[index] = {...messages[index], ...updatedMessage};
    renderMessages();
}

element('login-form')
    .addEventListener(
        'submit',
        async event => {
            event.preventDefault();
            const button = element('login-button');
            element('login-error',).textContent = '';
            button.disabled = true;
            button.textContent = 'Logging in...';
            try {
                const response =
                    await fetch(
                        `${API}/auth/login`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body:
                                JSON.stringify({
                                    organizationId: element('organization-id',).value.trim(),
                                    email: element('email',).value.trim(),
                                    password: element('password',).value,
                                }),
                        },
                    );

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message ??'Login failed',);
                }
                token =
                    result.token ??
                    result.accessToken ??
                    result.data?.token ??
                    result.data?.accessToken;

                if (!token) {
                    throw new Error('Login response does not contain token',);
                }
                currentUserEmail = element('email',).value.trim();
                localStorage.setItem('bevatel_token',token,);
                localStorage.setItem('bevatel_email',currentUserEmail,);
                showApp();
            } catch (error) {
                element('login-error',).textContent = error.message;
            } finally {
                button.disabled = false;
                button.textContent = 'Login';
            }
        },
    );


function logout() {
    disconnectSocket();

    token = null;
    currentUserEmail = null;
    selectedConversation = null;
    selectedChannelId = null;

    localStorage.removeItem(
        'bevatel_token',
    );

    localStorage.removeItem(
        'bevatel_email',
    );

    localStorage.removeItem(
        'bevatel_user',
    );

    localStorage.removeItem(
        'user',
    );

    localStorage.removeItem(
        'auth_user',
    );

    const appScreen =
        element('app-screen');

    const loginScreen =
        element('login-screen');

    if (appScreen) {
        appScreen.classList.add(
            'hidden',
        );
    }

    if (loginScreen) {
        loginScreen.classList.remove(
            'hidden',
        );
    }
}
 
const logoutButton = element('logout-button');
if (logoutButton) {
    logoutButton.addEventListener(
        'click',
        logout,
    );
}

async function showApp() {
    if (!token) {
        logout();
        return;
    }

    const loginScreen = element('login-screen');
    const appScreen = element('app-screen');
    const currentUserElement = element('current-user-email');
    if (loginScreen) {
        loginScreen.classList.add('hidden');
    }

    if (appScreen) {
        appScreen.classList.remove('hidden');
    }

    if (currentUserElement) {
        currentUserElement.textContent = currentUserEmail ?? 'Agent';
    }

    try {
        await refreshAll();
        if (!token) {
            return;
        }
        connectSocket();
    } catch (error) {
        console.error('Unable to initialize conversations:',error);
        if (!token) {
            return;
        }
        toast(error instanceof Error ? error.message : 'Unable to load conversations', 'error');
    }
}

async function refreshAll() {
    const results =
        await Promise.allSettled([
            loadChannels(),
            loadLabels(),
            loadConversations(),
        ]);

    const rejected = results.filter(result => result.status === 'rejected');
    if (rejected.length > 0) {
        console.warn('Some conversation resources failed to load:',rejected);
    }
    return results;
}

async function initializeApplication() {
    token = localStorage.getItem( 'bevatel_token');
    currentUserEmail = localStorage.getItem('bevatel_email');
    if (!token) {
        const appScreen = element('app-screen');
        const loginScreen = element('login-screen');
        if (appScreen) {
            appScreen.classList.add('hidden');
        }
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
        }
        return;
    }
    console.log('Existing authentication session found.');
    await showApp();
}

const refreshButton = element('refresh-button');
if (refreshButton) {
    refreshButton.addEventListener(
        'click',
        async () => {
            await refreshAll();
            toast('Inbox refreshed', 'success');
        },
    );
}
 
async function loadChannels() {
    try {
        const result = await api('/meta/accounts');
        channels = extractCollection(result,'accounts',);
        renderChannels();
    } catch (error) {
        console.error(error,);
        element('channels-sidebar-list',
        ).innerHTML =
            `
                <div class="sidebar-placeholder">
                    Failed to load channels
                </div>
            `;
    }
}


function channelIcon(channel,) {
    switch (channel) {
        case 'WHATSAPP':
            return {
                text: 'W',
                className: 'whatsapp',
            };

        case 'FACEBOOK':
            return {
                text: 'F',
                className: 'facebook',
            };

        case 'INSTAGRAM':
            return {
                text: 'I',
                className: 'instagram',
            };

        default:
            return {
                text: '#',
                className: 'other',
            };
    }
}


function renderChannels() {
    const container = element('channels-sidebar-list');
    if (channels.length === 0) {
        container.innerHTML =
            `
                <div class="sidebar-placeholder">
                    No channels connected
                </div>
            `;
        return;
    }

    container.innerHTML =
        channels
            .map(
                channel => {
                    const icon = channelIcon(channel.channel);
                    return `
                        <button class="channel-sidebar-item" data-channel-id="${escapeHtml(channel.id)}">
                            <span class="channel-sidebar-icon ${icon.className}">
                                ${icon.text}
                            </span>
                            <span class="channel-sidebar-name" >
                                ${escapeHtml(channel.name)}
                            </span>
                        </button>
                    `;
                },
            )
            .join('',);

    container
        .querySelectorAll('.channel-sidebar-item')
        .forEach(
            button => {
                button
                    .addEventListener(
                        'click',
                        () => {
                            selectChannel(button.dataset.channelId);
                        },
                    );
            },
        );
}

function selectChannel(channelId,) {
    selectedChannelId = channelId;
    const channel = channels.find(item => item.id === channelId);
    document
        .querySelectorAll('.channel-sidebar-item')
        .forEach(
            item => {
                item.classList.toggle('active',item.dataset.channelId === channelId);
            },
        );

    if (channel) {
        element('selected-channel-name').textContent = channel.name;
        element('selected-channel-type').textContent =channel.channel;
    }
    renderConversations();
}

async function loadLabels() {
    try {
        const result = await api('/labels');
        labels = extractCollection(result,'labels');
        renderLabels();
    } catch (error) {
        console.error(error,);
    }
}

function renderLabels() {
    const container = element('labels-sidebar-list',);
    container.innerHTML =
        labels.slice(0,10,)
            .map(
                label => `
                    <div class="label-sidebar-item">
                        <span class="label-dot"></span>
                        ${escapeHtml( label.name ?? label.title ?? 'Label', )}
                    </div>
                `,
            )
            .join('',);
}

async function loadConversations() {
    try {
        const result = await api('/conversations');
        conversations = extractCollection(result,'conversations');
        updateConversationCounters();
        renderConversations();
    } catch (error) {
        console.error(error,);
        element('conversations-list',).innerHTML =
            `
                <div class="empty-list">
                    ${escapeHtml(error.message,)}
                </div>
            `;
    }
}

function updateConversationCounters() {
    element('all-conversations-count').textContent =conversations.length;
    const unassigned = conversations.filter(conversation =>!conversation.assignedUserId);
    element('unassigned-count').textContent = unassigned.length;
    element('queue-all-count',).textContent =conversations.length;
    const mine = conversations.filter(conversation =>Boolean(conversation.assignedUserId,),);
    element('mine-count',).textContent =mine.length;
}


function getFilteredConversations() {
    let data =[...conversations,];
    if (selectedChannelId) {
        data = data.filter(conversation => conversation.channelAccountId === selectedChannelId,);
    }

    if (assignmentFilter === 'unassigned') {
        data = data.filter(conversation =>!conversation.assignedUserId,);
    }

    const status = element('status-filter',).value;
    if (status) {
        data = data.filter(conversation =>conversation.status === status,);
    }

    const search = element('conversation-search-input',).value.trim().toLowerCase();
    if (search) {
        data =
            data.filter(
                conversation => {
                    const haystack =
                        [
                            conversation.contact?.displayName,
                            conversation.contact?.phone,
                            conversation.subject,
                            conversation.messages?.[0]?.body,
                        ]
                            .filter(Boolean,)
                            .join(' ',).toLowerCase();
                    return haystack.includes(search,);
                },
            );
    }

    const sort = element('sort-filter',).value;
    data.sort(
        (first,second,) => {
            const a = new Date(first.lastMessageAt ??first.createdAt,).getTime();
            const b = new Date(second.lastMessageAt ??second.createdAt,).getTime();
            if (sort ==='oldest') {
                return a - b;
            }
            return b - a;
        },
    );
    return data;
}


function renderConversations() {
    const container = element('conversations-list',);
    const data = getFilteredConversations();

    if (data.length === 0 ) {
        container.innerHTML = 
            `
                <div class="empty-list">
                    No conversations found
                </div>
            `;
        return;
    }

    container.innerHTML =
        data
            .map(
                conversation => {
                    const contact = conversation.contact ??{};
                    const name = contact.displayName ??contact.phone ?? 'Unknown contact'; 
                    const latestMessage = conversation.messages?.[0];
                    const message = latestMessage?.body ?? (isMediaMessage(latestMessage) ? `[${latestMessage.type}]` : null) ?? conversation.subject ?? 'No messages yet';
                    const active = selectedConversation?.id === conversation.id;
                    return `
                        <button
                            class=" conversation-item ${active ? 'active' : '' }"
                            data-conversation-id="${escapeHtml(conversation.id,)}"
                        >
                            <div class="conversation-avatar">
                                ${escapeHtml(initials(name,),)}
                            </div>

                            <div class="conversation-content">
                                <div class="conversation-row">
                                    <span class="conversation-name">
                                        ${escapeHtml(name,)}
                                    </span>
                                    <span class="conversation-time">
                                        ${escapeHtml(formatDate(conversation.lastMessageAt ?? conversation.createdAt,))}
                                    </span>
                                </div>
                                <div class="conversation-preview-row" >
                                    <span class="conversation-channel-mini"> ↩ </span>
                                    <span class="conversation-preview">
                                        ${escapeHtml(message,)}
                                    </span>
                                </div>
                            </div>
                        </button>
                    `;
                },
            )
            .join('',);


    container.querySelectorAll('.conversation-item',)
        .forEach(
            button => {
                button
                    .addEventListener(
                        'click',
                        () => {
                            openConversation(button.dataset.conversationId,);
                        },
                    );
            },
        );
}

async function openConversation(conversationId) {
    try {
        const previousConversationId = selectedConversation?.id;
        const result = await api(`/conversations/${conversationId}`,);
        selectedConversation = result.data ?? result.conversation ?? result; 
        if (previousConversationId && previousConversationId !== selectedConversation.id && socket) {
            socket.emit('conversation:leave',previousConversationId);
        }
        joinConversationRoom(selectedConversation.id);
        renderActiveConversation();
        renderConversations();
    } catch (error) {
        toast(error.message,'error',);
    }
}


function renderActiveConversation() {
    if (!selectedConversation) {
        return;
    }
    element('empty-chat',).classList.add('hidden',);
    element('active-chat',).classList.remove('hidden',);
    const contact =selectedConversation.contact ??{};
    const name = contact.displayName ??contact.phone ??'Unknown Contact';
    const avatar = initials(name,);
    element('chat-contact-name',).textContent = name;
    element('chat-avatar',).textContent = avatar;
    element('details-avatar',).textContent = avatar;
    element('chat-channel',).textContent = selectedConversation.channel ??'';
    element('chat-contact-phone',).textContent = contact.phone ?? '';
    element('conversation-status',).value = selectedConversation.status ?? 'OPEN';
    element('details-name',).textContent = name;
    element('details-status',).textContent = contact.status ??'ACTIVE';
    element('details-phone',).textContent = contact.phone ?? '-';
    element('details-email',).textContent = contact.email ?? '-';
    element('details-company',).textContent = contact.company ??'-';
    element('details-channel',).textContent = selectedConversation .channel ?? '-';
    renderConversationLabels();
    renderMessages();
}

function renderConversationLabels() {
    const container = element('conversation-labels',);
    const items = selectedConversation?.labels ??[];
    if (items.length ===0) {
        container.innerHTML = ` <span style="color:#98a2b3; font-size:10px; " > No labels</span>`;
        return;
    }
    container.innerHTML =
        items
            .map(
                item => {
                    const label = item.label ?? item;
                    return ` <span class="conversation-label">${escapeHtml(label.name ??label.title ?? 'Label',)} </span>`;
                },
            )
            .join('',);
}


function isMediaMessage(message) {
    return [
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'DOCUMENT',
        'STICKER',
    ].includes(message?.type);
}


function getMessageDocumentFilename(message) {
    const filename = message?.metadata?.raw?.document?.filename;
    if (typeof filename === 'string' &&filename.trim()) {
        return filename.trim();
    }
    return `document-${message?.id ?? 'file'}`;
}


function getMediaCaption(message) {
    if (typeof message?.body === 'string' && message.body.trim()) {
        return message.body.trim();
    }
    const raw = message?.metadata?.raw;
    if (message?.type === 'IMAGE' && typeof raw?.image?.caption === 'string') {
        return raw.image.caption;
    }

    if (message?.type === 'VIDEO' && typeof raw?.video?.caption === 'string') {
        return raw.video.caption;
    }

    if (message?.type === 'DOCUMENT' && typeof raw?.document?.caption === 'string') {
        return raw.document.caption;
    }

    return '';
}


function renderMessageContent(message) {
    if (!isMediaMessage(message)) {
        return `
            <div class="message-text">
                ${escapeHtml(
                    message.body ?? `[${message.type}]`
                )}
            </div>
        `;
    }
    const caption = getMediaCaption(message);
    const filename = message.type === 'DOCUMENT' ? getMessageDocumentFilename(message) : '';
    return `
        <div
            class="message-media"
            data-message-id="${escapeHtml(message.id)}"
            data-message-type="${escapeHtml(message.type)}"
            data-document-filename="${escapeHtml(filename)}"
        >
            <div class="message-media-loading">
                Loading ${escapeHtml(
                    message.type.toLowerCase()
                )}...
            </div>
        </div>

        ${
            caption
                ? `
                    <div class="message-text message-caption">
                        ${escapeHtml(caption)}
                    </div>
                `
                : ''
        }
    `;
}

async function fetchMessageMediaBlob(messageId) {
    if (mediaObjectUrls.has(messageId)) {
        return mediaObjectUrls.get(messageId);
    }

    if (mediaRequests.has(messageId)) {
        return mediaRequests.get(messageId);
    }

    const request =
        (async () => {
            const response =
                await fetch(`${API}/meta/messages/${encodeURIComponent(messageId)}/media`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

            if (response.status === 401) {
                logout();
                throw new Error('Session expired');
            }

            if (!response.ok) {
                let errorMessage = 'Unable to load media';
                try {
                    const result = await response.json();
                    errorMessage = result.message ?? errorMessage;
                } catch (error) {
                }

                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            mediaObjectUrls.set(messageId,objectUrl);
            return objectUrl;
        })();

    mediaRequests.set(messageId,request);
    try {
        return await request;
    } finally {
        mediaRequests.delete(messageId);
    }
}


function buildMediaElement(messageType,objectUrl,filename) 
{
    if (messageType === 'IMAGE') {
        const image = document.createElement('img');
        image.className = 'message-media-image';
        image.src = objectUrl;
        image.alt = 'WhatsApp image';
        image.loading = 'lazy';
        image.addEventListener('click', () => {window.open(objectUrl,'_blank','noopener,noreferrer');});

        return image;
    }

    if (messageType === 'STICKER') {
        const image = document.createElement('img');
        image.className = 'message-media-sticker';
        image.src = objectUrl;
        image.alt = 'WhatsApp sticker';
        image.loading = 'lazy';
        return image;
    }

    if (messageType === 'VIDEO') {
        const video = document.createElement('video');
        video.className = 'message-media-video';
        video.src = objectUrl;
        video.controls = true;
        video.preload = 'metadata';
        video.playsInline = true;
        return video;
    }

    if (messageType === 'AUDIO') {
        const audio = document.createElement('audio');
        audio.className = 'message-media-audio';
        audio.src = objectUrl;
        audio.controls = true;
        audio.preload = 'metadata';
        return audio;
    }

    if (messageType === 'DOCUMENT') {
        const link = document.createElement('a');
        link.className = 'message-document-link';
        link.href = objectUrl;
        link.download = filename || 'document';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const icon = document.createElement('span');
        icon.className = 'message-document-icon';
        icon.textContent = '📄';
        const details = document.createElement('span');
        details.className = 'message-document-details';
        const name = document.createElement('strong');
        name.textContent =filename || 'Document';
        const action = document.createElement('small');
        action.textContent = 'Open / download';
        details.append(name,action);
        link.append(icon,details);
        return link;
    }

    return null;
}


async function hydrateMessageMedia() {
    const nodes = document.querySelectorAll('#messages-container .message-media[data-message-id]');
    await Promise.allSettled(
        Array.from(nodes).map(
            async node => {
                const messageId = node.dataset.messageId;
                const messageType = node.dataset.messageType;
                const filename = node.dataset.documentFilename ?? '';
                if (!messageId ||!messageType) {
                    return;
                }

                try {
                    const objectUrl = await fetchMessageMediaBlob(messageId); 
                    if (!document.body.contains(node)) {
                        return;
                    }

                    const mediaElement = buildMediaElement(messageType,objectUrl,filename);
                    if (!mediaElement) {
                        throw new Error('Unsupported media type');
                    }

                    node.replaceChildren(mediaElement);
                } catch (error) {
                    if ( 
                        !document.body.contains(node)) {
                        return;
                    }
                    node.innerHTML = '';
                    const failed = document.createElement('div');
                    failed.className = 'message-media-error';
                    failed.textContent = error instanceof Error ? error.message : 'Unable to load media';
                    node.appendChild(failed);
                }
            }
        )
    );
}




function renderMessages() {
    const container = element('messages-container');
    const messages = selectedConversation?.messages ?? [];

    if (messages.length === 0) {
        container.innerHTML = `<div style="padding:40px;text-align:center;color:#98a2b3;font-size:11px;">No messages yet</div>`;
        return;
    }

    container.innerHTML =
        messages
            .map(message => {
                const direction = message.direction === 'OUTBOUND' ? 'outbound' : 'inbound';
                const canEdit = message.direction === 'OUTBOUND' && message.type === 'TEXT' && message.status !== 'FAILED' && Boolean(message.body);
                return `
                    <div class="message-row ${direction}" data-message-id="${escapeHtml(message.id)}">
                        <div class="message-bubble">
                            ${
                                message.purpose === 'FOLLOW_UP'
                                    ? `
                                        <div
                                            class="message-follow-up-label"
                                            style="font-size:9px;font-weight:700; text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px; opacity:.7;">
                                            Follow-up
                                        </div>
                                    `
                                    : ''
                            }

                            ${renderMessageContent(message)}
                            <div class="message-meta">
                                <span>
                                    ${escapeHtml(formatMessageTime(message.createdAt))}
                                </span>
                                ${direction === 'outbound' ? `<span class="message-status"> ${getMessageStatusIcon(message.status)} </span> ` : ''}
                                ${
                                    canEdit
                                        ? `
                                            <button
                                                type="button"
                                                class="message-edit-button"
                                                data-message-id="${escapeHtml(
                                                    message.id
                                                )}"
                                                title="Edit message"
                                                style="
                                                    border:0;
                                                    background:transparent;
                                                    cursor:pointer;
                                                    padding:0 3px;
                                                    font-size:10px;
                                                    opacity:.75;
                                                "
                                            >
                                                Edit
                                            </button>
                                        `
                                        : ''
                                }
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');

    container
        .querySelectorAll('.message-edit-button')
        .forEach(button => {
            button.addEventListener(
                'click',
                () => {
                    const messageId = button.dataset.messageId;
                    if (!messageId) {
                        return;
                    }
                    editMessage(messageId);
                },
            );
        });

    container.scrollTop = container.scrollHeight;
    hydrateMessageMedia()
        .then(() => {
            container.scrollTop = container.scrollHeight;
        })
        .catch(error => {
            console.error('Media hydration error:',error,);
        });
}

function editMessage(messageId) {
    if (!selectedConversation) {
        toast('Please select a conversation', 'error');
        return;
    }

    const messages = selectedConversation.messages ?? [];
    const message = messages.find(item => item.id === messageId);
    if (!message) {
        toast('Message not found', 'error');
        return;
    }

    if (message.direction !== 'OUTBOUND') {
        toast('Only outbound messages can be edited', 'error');
        return;
    }

    if (message.type !== 'TEXT') {
        toast('Only text messages can be edited', 'error');
        return;
    }

    if (!message.body) {
        toast('This message has no text to edit', 'error');
        return;
    }

    const newBody = window.prompt(
        'Edit message:',
        message.body
    );

    if (newBody === null) {
        return;
    }

    const cleanBody = newBody.trim();

    if (!cleanBody) {
        toast('Message cannot be empty', 'error');
        return;
    }

    if (cleanBody === message.body.trim()) {
        toast('No changes were made', '');
        return;
    }

    submitMessageEdit(messageId,cleanBody);
}


async function submitMessageEdit(messageId,newBody) 
{
    if (!selectedConversation) {
        toast('Please select a conversation', 'error');
        return;
    }

    const messages = selectedConversation.messages ?? [];
    const messageIndex = messages.findIndex(message => message.id === messageId);
    if (messageIndex < 0) {
        toast('Message not found', 'error');
        return;
    }

    try {
        const result = await api(`/meta/messages/${encodeURIComponent(messageId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify({body: newBody,}),
            }
        );

        const updatedMessage = result.data ?? result.message ?? result;
        if (updatedMessage && typeof updatedMessage === 'object' && updatedMessage.id ) {
            messages[messageIndex] = {...messages[messageIndex], ...updatedMessage,};
        } else {
            messages[messageIndex] = {...messages[messageIndex], body: newBody,};
        }

        renderMessages();

        const conversationIndex = conversations.findIndex(conversation => conversation.id === selectedConversation.id);
        if (conversationIndex >= 0) {
            const conversation = conversations[conversationIndex];

            if (
                Array.isArray(conversation.messages) &&
                conversation.messages.length > 0 &&
                conversation.messages[0]?.id === messageId
            ) {
                conversation.messages[0] = { ...conversation.messages[0], body: newBody};
            }

            renderConversations();
        }

        toast('Message updated successfully','success');
    } catch (error) {
        console.error('Unable to edit message:',error);
        toast(error instanceof Error ? error.message : 'Unable to edit message', 'error');
    }
}

function getMessageStatusIcon(status,) {
    switch (status) {
        case 'READ': 
        return '✓✓';
        case 'DELIVERED':
            return '✓✓';
        case 'SENT':
            return '✓';
        case 'FAILED':
            return '⚠';
        case 'QUEUED':
            return '◷';
        default:
            return '';
    }
}

async function sendConversationMessage(purpose = 'NORMAL') {
    if (!selectedConversation) {
        toast('Please select a conversation', 'error');
        return;
    }

    const input = element('message-input');
    if (!input) {
        toast('Message input was not found', 'error');
        return;
    }

    const body = input.value.trim();
    if (!body) {
        toast(purpose === 'FOLLOW_UP' ? 'Please enter a follow-up message' : 'Please enter a message', 'error');
        input.focus();
        return;
    }
    const sendButton = element('send-message-button');
    const followUpButton = element('follow-up-message-button');
    if (sendButton) {
        sendButton.disabled = true;
    }
    if (followUpButton) {
        followUpButton.disabled = true;
    }
    input.disabled = true;
    try {
        await api(`/meta/conversations/${selectedConversation.id}/messages`,{
                method: 'POST',
                body: JSON.stringify({
                    type: 'TEXT',
                    body,
                    purpose,
                }),
            },
        );

        input.value = '';

        await openConversation(selectedConversation.id);
        await loadConversations();
        toast(purpose === 'FOLLOW_UP' ? 'Follow-up sent' : 'Message sent', 'success');
    } catch (error) {
        toast(error instanceof Error ? error.message : 'Unable to send message', 'error');
    } finally {
        if (sendButton) {
            sendButton.disabled = false;
        }

        if (followUpButton) {
            followUpButton.disabled = false;
        }

        input.disabled = false;
        input.focus();
    }
}

const messageForm = element('message-form');
if (messageForm) {
    messageForm.addEventListener('submit',
        async event => { 
            event.preventDefault();
            await sendConversationMessage('NORMAL');
        },
    );
}


function initializeFollowUpButton() {
    const sendButton = element('send-message-button');
    if (!sendButton) {
        console.warn('Send message button was not found.',);
        return;
    }
    if (element('follow-up-message-button')) {
        return;
    }
    const followUpButton = document.createElement('button');
    followUpButton.id = 'follow-up-message-button';
    followUpButton.type = 'button';
    followUpButton.className = sendButton.className;
    followUpButton.textContent = 'Follow Up';
 
    sendButton.parentNode.insertBefore(followUpButton,sendButton);
    followUpButton.addEventListener('click', async () => {await sendConversationMessage('FOLLOW_UP',);},);
}


initializeFollowUpButton();


let searchTimer;
element('conversation-search-input',)
    .addEventListener(
        'input',
        () => {
            clearTimeout(searchTimer,);
            searchTimer = setTimeout(renderConversations,250,);
        },
    );

element('status-filter',).addEventListener('change',renderConversations,);
element('sort-filter',).addEventListener('change',renderConversations,);

document.querySelectorAll('.assignment-tab',)
    .forEach(
        button => {
            button.addEventListener('click',
                    () => {
                        assignmentFilter = button.dataset.assignmentFilter;
                        document.querySelectorAll('.assignment-tab',).forEach(item => item.classList.remove('active',),);
                        button.classList.add('active',);
                        renderConversations();
                    },
                );
        },
    );

document.querySelectorAll('.sidebar-item',)
    .forEach(
        button => {
            button
                .addEventListener(
                    'click',
                    () => {
                        sidebarFilter = button.dataset.inboxFilter;
                        document.querySelectorAll('.sidebar-item',).forEach(item => item.classList.remove('active',),);
                        button.classList.add('active',);
                        selectedChannelId = null;
                        document.querySelectorAll('.channel-sidebar-item',).forEach(item =>item.classList.remove('active',),);
                        element('selected-channel-name',).textContent = button.textContent.trim();
                        element('selected-channel-type',).textContent = 'All';
                        renderConversations();
                    },
                );
        },
    );

element('contact-info-button',)
    .addEventListener(
        'click',
        () => {
            element('contact-details-panel',).classList.toggle('hidden',);
        },
    );


element('close-contact-info',)
    .addEventListener(
        'click',
        () => {
            element('contact-details-panel',).classList.add('hidden',);
        },
    );

element('filter-toggle',)
.addEventListener(
        'click',
        () => {
            element('conversation-filters',).classList.toggle('hidden',);
        },
    );


initializeApplication()
    .catch(
        error => {
            console.error('Application initialization failed:', error);
        },
    );