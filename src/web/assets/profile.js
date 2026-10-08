const API_URL = '/api/profile';
const TOKEN_KEY = 'bevatel_token';

const elements = {
    loading: document.getElementById('profile-loading'),
    container: document.getElementById('profile-container'),
    error: document.getElementById('profile-error'),
    profileForm: document.getElementById('profile-form',),
    passwordForm: document.getElementById('password-form',),
    name: document.getElementById('profile-name',),
    email: document.getElementById('profile-email',),
    role: document.getElementById('profile-role',),
    status: document.getElementById('profile-status',),
    userId: document.getElementById('profile-user-id',),
    organizationId: document.getElementById('profile-organization-id',),
    createdAt: document.getElementById('profile-created-at',),
    currentPassword: document.getElementById('current-password',),
    newPassword: document.getElementById('new-password',),
    newPasswordConfirmation: document.getElementById('new-password-confirmation',),
    saveProfileButton: document.getElementById('save-profile-button',),
    updatePasswordButton: document.getElementById('update-password-button',),
    nameError: document.getElementById('name-error',),
    emailError: document.getElementById('email-error',),
    passwordError: document.getElementById('password-error',),
    toast: document.getElementById('profile-toast',),
};

let toastTimer =  null; 
function getToken() {
    return localStorage.getItem(TOKEN_KEY,);
}

function redirectToLogin() {
    window.location.href = '/admin/conversations';
}

function clearAuthentication() 
{
    localStorage.removeItem('bevatel_token',);
    localStorage.removeItem('bevatel_email',);
    localStorage.removeItem('bevatel_user',);
    localStorage.removeItem('user',);
    localStorage.removeItem('auth_user',);
}

async function apiRequest(url,options = {}) 
{
    const token = getToken();
    if (!token) {
        redirectToLogin();
        throw new Error('Authentication required.',);
    }

    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
    };

    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {...options, headers},);
    let result = null;
    try {
        result = await response.json();
    } catch {
        result = null;
    }

    if (response.status === 401) {
        clearAuthentication();
        redirectToLogin();
        throw new Error('Your session has expired.',);
    }

    if (!response.ok) {
        const error = new Error(result?.message ??'Request failed.',);
        error.status = response.status;
        error.data = result;
        throw error;
    }

    return result;
}


async function loadProfile() {
    showLoading();
    try {
        const result = await apiRequest(API_URL);
        const profile = result?.data;
        if (!profile) {
            throw new Error('Profile data was not returned by the server.',);
        }
        renderProfile(profile,);
        elements.loading.classList.add('hidden',);
        elements.container.classList.remove('hidden',);
    } catch (error) {
        elements.loading.classList.add('hidden',);
        showPageError(error.message ??'Unable to load profile.',);
    }
}

function renderProfile(profile,) 
{
    elements.name.value = profile.name ?? '';
    elements.email.value = profile.email ?? '';
    elements.role.value = formatValue(profile.role,);
    elements.status.value = formatValue(profile.status,);
    elements.userId.textContent = profile.id ?? '-';
    elements.organizationId.textContent = profile.organizationId ?? '-';
    elements.createdAt.textContent = formatDate(profile.createdAt,);
}


async function handleProfileSubmit(event,) {
    event.preventDefault();
    clearProfileErrors();
    const name = elements.name.value.trim();
    const email = elements.email.value.trim().toLowerCase();
    if (name.length < 2) {
        elements.nameError.textContent = 'Name must contain at least 2 characters.';
        return;
    }

    if (!email) {
        elements.emailError.textContent = 'Email is required.';
        return;
    }
    setButtonLoading(elements.saveProfileButton,true,'Saving...',);
    try {
        const result = await apiRequest(API_URL,
                {
                    method: 'PATCH',
                    body: JSON.stringify({
                            name,
                            email,
                        }),
                },
            );

        if (result?.data) {
            renderProfile(result.data,);
        }
        localStorage.setItem('bevatel_email',email,);
        showToast(result?.message ??'Profile updated successfully.','success',);
    } catch (error) {
        handleValidationErrors(error);
        showToast(error.message ??'Unable to update profile.','error',);
    } finally {
        setButtonLoading(elements.saveProfileButton,false,'Save Changes',);
    }
}

async function handlePasswordSubmit(event,) {
    event.preventDefault();
    hidePasswordError();
    const currentPassword = elements.currentPassword.value;
    const newPassword = elements.newPassword.value;
    const newPasswordConfirmation = elements.newPasswordConfirmation.value;

    if (newPassword.length < 8) {
        showPasswordError('New password must contain at least 8 characters.',);
        return;
    }

    if (newPassword !==newPasswordConfirmation) {
        showPasswordError('New password confirmation does not match.',);
        return;
    }

    if (currentPassword ===newPassword) {
        showPasswordError('New password must be different from the current password.',);
        return;
    }
    setButtonLoading(elements.updatePasswordButton,true,'Updating...',);

    try {
        const result = await apiRequest(`${API_URL}/password`,{
                    method: 'PATCH',
                    body: JSON.stringify({
                            currentPassword,
                            newPassword,
                            newPasswordConfirmation,
                        }),
                },
            );

        elements.passwordForm.reset();
        showToast(result?.message ??'Password updated successfully.','success',);
    } catch (error) {

        const message =getFirstValidationMessage(error,) ??error.message ??'Unable to update password.';
        showPasswordError(message,);
        showToast(message,'error',);
    } finally {
        setButtonLoading(elements.updatePasswordButton,false,'Update Password',);
    }
}

function handleValidationErrors(error,) 
{
    const issues = error?.data?.errors;
    if (!Array.isArray(issues,)) {
        return;
    }
    for (const issue of issues) {
        const field = issue?.path?.[0];
        if (field === 'name') {
            elements.nameError.textContent = issue.message ?? '';
        }
        if (field === 'email') {
            elements.emailError.textContent = issue.message ?? '';

        }
    }
}

function getFirstValidationMessage(error,) 
{
    const issues = error?.data?.errors;
    if (!Array.isArray( issues, ) || issues.length === 0 ) {
        return null;
    }
    return issues[0]?.message ??  null;
}

function clearProfileErrors() 
{
    elements.nameError.textContent = '';
    elements.emailError.textContent = '';
}

function showLoading() 
{
    elements.error.classList.add('hidden',);
    elements.container.classList.add('hidden',);
    elements.loading.classList.remove('hidden',);
}

function showPageError(message,) {
    elements.error.textContent = message;
    elements.error.classList.remove('hidden',);
}

function showPasswordError(message,) 
{
    elements.passwordError.textContent = message;
    elements.passwordError.classList.remove('hidden',);
}

function hidePasswordError() 
{
    elements.passwordError.textContent = '';
    elements.passwordError.classList.add('hidden',);
}

function setButtonLoading(button,loading,text,) 
{
    button.disabled = loading;
    button.textContent = text;
}

function showToast(message,type = 'success',) 
{
    if (toastTimer) {
        clearTimeout(toastTimer,);
    }
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden','success','error',);
    elements.toast.classList.add(type);
    toastTimer = setTimeout( () => {elements.toast.classList.add('hidden');}, 3500);
}


function formatValue(value,) {

    if (!value) { return '-'; }
    return String(value,)
        .replaceAll('_',' ',)
        .toLowerCase()
        .replace(/\b\w/g,character => character.toUpperCase(),);
}


function formatDate(value) 
{
    if (!value) {return '-';}
    const date = new Date(value);
    if (Number.isNaN(date.getTime(),)) {
        return '-';
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        },
    ).format(date);
}

function initializeEvents() {
    elements.profileForm.addEventListener('submit',handleProfileSubmit,);
    elements.passwordForm.addEventListener('submit',handlePasswordSubmit,);
}

async function initialize()
{
    if (!getToken()) {
        redirectToLogin();
        return;
    }
    initializeEvents();
    await loadProfile();
}


initialize();