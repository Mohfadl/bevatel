(() => {
  const token = localStorage.getItem('bevatel_token');
  if (!token) { window.location.href = '/admin/conversations'; return; }

  const $ = selector => document.querySelector(selector);
  const modal = $('#campaign-modal');
  const tbody = $('#campaign-table-body');
  const empty = $('#campaign-empty');
  const message = $('#campaign-message');
  let searchTimer;

  async function api(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('bevatel_token');
      window.location.href = '/admin/conversations';
      throw new Error('Session expired.');
    }
    if (!response.ok) throw new Error(payload.message || 'Request failed.');
    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[char]);
  }

  function formatDate(value) {
    if (!value) return 'Now';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
  }

  function showError(error) {
    message.textContent = error instanceof Error ? error.message : String(error);
    message.classList.remove('hidden');
  }

  async function loadCampaigns() {
    message.classList.add('hidden');
    const params = new URLSearchParams();
    const status = $('#status-filter').value;
    const search = $('#campaign-search').value.trim();
    if (status) params.set('status', status);
    if (search) params.set('search', search);

    try {
      const result = await api(`/api/campaigns?${params.toString()}`);
      const campaigns = result.data.campaigns || [];
      tbody.innerHTML = campaigns.map(campaign => `
        <tr>
          <td><strong>${escapeHtml(campaign.title)}</strong><br><small>${escapeHtml(campaign.templateName)}</small></td>
          <td>${escapeHtml(campaign.channelAccount?.name || 'WhatsApp')}</td>
          <td>${campaign.audienceType === 'LABEL' ? escapeHtml(campaign.audienceLabel?.name || 'Label') : 'All Contacts'}</td>
          <td><span class="campaign-status ${escapeHtml(campaign.status)}">${escapeHtml(campaign.status)}</span></td>
          <td>${escapeHtml(formatDate(campaign.scheduledAt))}</td>
          <td>${campaign.totalRecipients}</td><td>${campaign.sentCount}</td>
          <td>${campaign.deliveredCount}</td><td>${campaign.readCount}</td><td>${campaign.failedCount}</td>
          <td>${['SCHEDULED','RUNNING','DRAFT'].includes(campaign.status) ? `<button class="campaign-action" data-cancel="${campaign.id}">Cancel</button>` : ''}</td>
        </tr>`).join('');
      empty.classList.toggle('hidden', campaigns.length !== 0);
    } catch (error) { showError(error); }
  }

  async function loadOptions() {
    const result = await api('/api/campaigns/options');
    const channels = result.data.channels || [];
    const labels = result.data.labels || [];
    $('#channel-account-id').innerHTML = '<option value="">Select WhatsApp channel</option>' +
      channels.map(item => `<option value="${item.id}">${escapeHtml(item.name)}${item.phoneNumberId ? ` (${escapeHtml(item.phoneNumberId)})` : ''}</option>`).join('');
    $('#audience-label-id').innerHTML = '<option value="">Select label</option>' +
      labels.map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  }

  function openModal() {
    $('#campaign-form').reset();
    $('#template-language').value = 'en';
    $('#label-field').classList.add('hidden');
    $('#form-error').classList.add('hidden');
    modal.classList.remove('hidden');
    loadOptions().catch(showError);
  }

  function closeModal() { modal.classList.add('hidden'); }

  $('#create-campaign-button').addEventListener('click', openModal);
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeModal));
  $('#audience-type').addEventListener('change', event => {
    $('#label-field').classList.toggle('hidden', event.target.value !== 'LABEL');
  });
  $('#refresh-labels').addEventListener('click', () => loadOptions().catch(showError));
  $('#status-filter').addEventListener('change', loadCampaigns);
  $('#clear-filter').addEventListener('click', () => { $('#status-filter').value=''; $('#campaign-search').value=''; loadCampaigns(); });
  $('#campaign-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer=setTimeout(loadCampaigns,350); });

  tbody.addEventListener('click', async event => {
    const button = event.target.closest('[data-cancel]');
    if (!button || !confirm('Cancel this campaign?')) return;
    try { await api(`/api/campaigns/${button.dataset.cancel}/cancel`, { method:'POST' }); await loadCampaigns(); }
    catch (error) { showError(error); }
  });

  $('#campaign-form').addEventListener('submit', async event => {
    event.preventDefault();
    const errorBox = $('#form-error');
    const submit = $('#campaign-submit');
    errorBox.classList.add('hidden');
    let components = null;
    const rawComponents = $('#template-components').value.trim();
    if (rawComponents) {
      try {
        components = JSON.parse(rawComponents);
        if (!Array.isArray(components)) throw new Error('Components must be a JSON array.');
      } catch (error) {
        errorBox.textContent = error.message || 'Invalid template components JSON.';
        errorBox.classList.remove('hidden');
        return;
      }
    }

    const scheduledValue = $('#scheduled-at').value;
    const body = {
      channelAccountId: $('#channel-account-id').value,
      title: $('#campaign-title').value.trim(),
      audienceType: $('#audience-type').value,
      audienceLabelId: $('#audience-type').value === 'LABEL' ? $('#audience-label-id').value : null,
      templateName: $('#template-name').value.trim(),
      templateLanguageCode: $('#template-language').value.trim(),
      templateComponents: components,
      scheduledAt: scheduledValue ? new Date(scheduledValue).toISOString() : null,
    };

    submit.disabled = true;
    submit.textContent = 'Creating...';
    try {
      await api('/api/campaigns', { method:'POST', body:JSON.stringify(body) });
      closeModal();
      await loadCampaigns();
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : String(error);
      errorBox.classList.remove('hidden');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create';
    }
  });

  loadCampaigns();
})();
