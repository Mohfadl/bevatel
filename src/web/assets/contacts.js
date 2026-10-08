(() => {
    'use strict';

    const API_URL = '/api/contacts';
    const STORAGE_KEY = 'bevatel_contact_columns';

    const state = {
        contacts: [],
        filteredContacts: [],
        selectedIds: new Set(),
        currentPage: 1,
        pageSize: 25,
        search: '',
        columns: [
            {
                key: 'name',
                label: 'Name',
                enabled: true,
                required: true,
            },
            {
                key: 'email',
                label: 'Email Address',
                enabled: true,
            },
            {
                key: 'phone',
                label: 'Phone Number',
                enabled: true,
            },
            {
                key: 'company',
                label: 'Company',
                enabled: true,
            },
            {
                key: 'city',
                label: 'City',
                enabled: true,
            },
            {
                key: 'country',
                label: 'Country',
                enabled: true,
            },
            {
                key: 'socialProfiles',
                label: 'Social Profiles',
                enabled: true,
            },
            {
                key: 'status',
                label: 'Status',
                enabled: true,
            },
            {
                key: 'createdAt',
                label: 'Created At',
                enabled: true,
            },
            {
                key: 'updatedAt',
                label: 'Last Activity',
                enabled: true,
            },
        ],
    };


    const elements = {
        tableHead: document.getElementById('contacts-table-head'),
        tableBody: document.getElementById('contacts-table-body'),
        search: document.getElementById('contact-search'),
        selectedCount: document.getElementById('selected-count'),
        selectAll: document.getElementById('select-all-button'),
        deleteSelected: document.getElementById('delete-selected-button'),
        customizeColumns: document.getElementById('customize-columns-button'),
        columnsModal: document.getElementById('columns-modal'),
        closeColumnsModal: document.getElementById('close-columns-modal'),
        cancelColumns: document.getElementById('cancel-columns-button'),
        saveColumns: document.getElementById('save-columns-button'),
        columnsList: document.getElementById('columns-list'),
        columnsCount: document.getElementById('columns-count'),
        columnSearch: document.getElementById('column-search'),
        previousPage: document.getElementById('previous-page'),
        nextPage: document.getElementById('next-page'),
        pageNumber: document.getElementById('page-number'),
        pageSize: document.getElementById('page-size'),
        totalContacts: document.getElementById('total-contacts'),
        paginationResults: document.getElementById('pagination-results'),
        contactDetailsModal: document.getElementById('contact-details-modal'),
        closeContactDetails: document.getElementById('close-contact-details'),
        contactDetailsContent: document.getElementById('contact-details-content'),
        toast: document.getElementById('contacts-toast'),
        exportButton: document.getElementById('export-button'),
        newContactButton: document.getElementById('new-contact-button'),
    };

    function getToken() {
        return (localStorage.getItem('bevatel_token',) || '');
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&','&amp;')
            .replaceAll('<','&lt;')
            .replaceAll('>','&gt;')
            .replaceAll('"','&quot;')
            .replaceAll("'",'&#039;');
    }

    function initials(name) {
        const words =
            String(name ?? '')
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        if (!words.length) {
            return 'C';
        }

        if (words.length === 1) {
            return words[0]
                .substring(0, 2)
                .toUpperCase();
        }

        return (
            words[0][0] +
            words[1][0]
        ).toUpperCase();
    }

    function showToast(message,error = false) {
        elements.toast.textContent = message;
        elements.toast.className = error ? 'toast show error' : 'toast show';
        window.setTimeout(
            () => {
                elements.toast.className = 'toast';
            },
            3000,
        );
    }

    function normalizeContact(contact) {
        const attributes = contact?.attributes && typeof contact.attributes === 'object' ? contact.attributes : {};

        const identities = Array.isArray(contact?.identities,) ? contact.identities : [];

        const socialChannels =
            identities.filter((identity) => ['FACEBOOK','INSTAGRAM','WHATSAPP'].includes(String(identity.channel ??'').toUpperCase()))
                .map((identity) => String(identity.channel).toUpperCase());

        return {
            ...contact,
            id: String(contact.id ?? '',),
            name: contact.displayName ?? contact.name ?? [contact.firstName, contact.lastName].filter(Boolean).join(' ') ?? 'Unknown',
            email: contact.email ?? '',
            phone: contact.phone ?? '',
            company: contact.company ??  '',
            city: contact.city ?? attributes.city ?? '',
            country: contact.country ?? attributes.country ?? '',
            socialProfiles: [...new Set(socialChannels)],
            status: contact.status ?? '',
            createdAt: contact.createdAt ?? '',
            updatedAt: contact.updatedAt ?? '',
        };
    }

    function extractContacts(result) {
        if (Array.isArray(result)) {
            return result;
        }
        if (Array.isArray(result?.data)) {
            return result.data;
        }
        if (Array.isArray(result?.contacts)) {
            return result.contacts;
        }
        if (Array.isArray(result?.data?.contacts)) {
            return result.data.contacts;
        }
        if (Array.isArray(result?.data?.items)) {
            return result.data.items;
        }
        return [];
    }

    async function loadContacts() {
        const token = getToken();
        if (!token) {
            window.location.href = '/admin/conversations';
            return;
        }

        try {
            const response =
                await fetch(
                    API_URL,
                    {
                        headers: {
                            Accept: 'application/json',
                            Authorization: `Bearer ${token}`,
                        },
                        cache: 'no-store',
                    },
                );

            if (response.status === 401) {
                localStorage.removeItem('bevatel_token');
                window.location.href = '/admin/conversations';
                return;
            }

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message ??'Unable to load contacts');
            }

            state.contacts = extractContacts(result).map(normalizeContact);
            applyFilters();

        } catch (error) {
            console.error('Load contacts error:', error);
            elements.tableBody.innerHTML = `
                <tr>
                    <td class="empty-table-cell">
                        ${escapeHtml(error instanceof Error ? error.message : 'Unable to load contacts')}
                    </td>
                </tr>
            `;

            showToast(error instanceof Error ? error.message : 'Unable to load contacts', true);
        }
    }


    function applyFilters() {
        const search = state.search.trim().toLowerCase();
        if (!search) {
            state.filteredContacts =
                [...state.contacts];
        } else {
            state.filteredContacts =
                state.contacts.filter(
                    (contact) => {
                        const searchable = [
                            contact.name,
                            contact.email,
                            contact.phone,
                            contact.company,
                            contact.city,
                            contact.country,
                            contact.status,
                            contact.socialProfiles.join(
                                ' ',
                            ),
                        ]
                            .join(' ')
                            .toLowerCase();
                        return searchable.includes(search);
                    },
                );
        }

        const totalPages = getTotalPages();
        if (state.currentPage > totalPages ) {
            state.currentPage = totalPages;
        }
        render();
    }

    function getEnabledColumns() {
        return state.columns.filter((column) => column.enabled);
    }

    function getTotalPages() {
        return Math.max(1,Math.ceil(state.filteredContacts.length /state.pageSize));
    }

    function getCurrentContacts() {
        const start = (state.currentPage - 1) * state.pageSize;
        return state.filteredContacts.slice(start,start +state.pageSize);
    }

    function renderTableHeader() {
        const columns = getEnabledColumns();
        elements.tableHead.innerHTML = `
            <tr>
                <th>
                    <input id="header-checkbox" class="row-checkbox" type="checkbox">
                </th>
                ${columns.map((column) => `<th>${escapeHtml(column.label,)}</th>`,).join('')}
            </tr>
        `;
        document.getElementById('header-checkbox') ?.addEventListener('change', (event) => {toggleCurrentPage(event.target.checked);});
    }


    function renderCell(contact,column) {
        if (column.key === 'name') {
            return `
                <td>
                    <div class="contact-name-cell">
                        <input
                            class="row-checkbox contact-checkbox"
                            type="checkbox"
                            data-contact-id="${escapeHtml(contact.id)}"
                            ${state.selectedIds.has(contact.id) ? 'checked' : ''}
                        >
                        <div class="contact-avatar">
                            ${escapeHtml(initials(contact.name))}
                        </div>
                        <div class="contact-name-info">
                            <span class="contact-name">
                                ${escapeHtml(contact.name)}
                            </span>

                            <button class="view-details" type="button" data-view-contact="${escapeHtml(contact.id)}">
                                View details
                            </button>
                        </div>
                    </div>
                </td>
            `;
        }

        if ( column.key === 'socialProfiles') {
            if (!contact.socialProfiles.length) {
                return ` <td class="empty-value"> --- </td> `;
            }

            return `
                <td>
                    ${
                        contact
                            .socialProfiles
                            .map(
                                (channel) => `
                                    <span class="social-profile" title="${escapeHtml(channel)}">
                                        ${channel === 'INSTAGRAM' ? '◎' : channel === 'FACEBOOK' ? 'f' : '◉' }
                                    </span>
                                `,
                            )
                            .join(' ')
                    }
                </td>
            `;
        }


        if (column.key === 'createdAt' || column.key === 'updatedAt') {
            const value = contact[column.key];
            return `<td>${value ? escapeHtml( new Date( value, ).toLocaleString()) : '<span class="empty-value">---</span>'}</td>`;
        }
        const value = contact[column.key];
        return `<td>${value ? escapeHtml(value,) : '<span class="empty-value">---</span>'}</td>`;
    }


    function renderTableBody() {
        const contacts = getCurrentContacts();

        const columns = getEnabledColumns();

        if (!contacts.length) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="${columns.length + 1}" class="empty-table-cell">
                        No contacts found
                    </td>
                </tr>
            `;
            return;
        }

        elements.tableBody.innerHTML =
            contacts.map(
                    (contact) => `
                        <tr>
                            <td>
                            </td>
                            ${columns.map((column,) => renderCell(contact,column),).join('')}
                        </tr>
                    `,
                )
                .join('');


        document.querySelectorAll('.contact-checkbox',)
            .forEach(
                (checkbox) => {
                    checkbox.addEventListener(
                        'change',
                        (event) => {
                            const id = event.target.dataset.contactId;
                            if (event.target.checked) {
                                state.selectedIds.add(id);
                            } else {
                                state.selectedIds.delete(id);
                            }
                            renderSelection();
                        },
                    );
                },
            );

        document.querySelectorAll('[data-view-contact]')
            .forEach(
                (button) => {
                    button.addEventListener(
                        'click',
                        () => {
                            showContactDetails(button.dataset.viewContact);
                        },
                    );
                },
            );
    }


    function renderSelection() {
        const count = state.selectedIds.size;
        elements.selectedCount.textContent = `${count} Contact${ count === 1 ? '' : 's'} Selected`;
        elements.deleteSelected.classList.toggle('hidden', count === 0);
    }


    function renderPagination() {
        const total = state.filteredContacts.length;
        const start = total ? (state.currentPage - 1) * state.pageSize + 1 : 0;
        const end = Math.min(state.currentPage * state.pageSize, total);
        const totalPages = getTotalPages();
        elements.pageNumber.value = String(state.currentPage);
        elements.pageNumber.max = String(totalPages);
        elements.totalContacts.textContent = `Total ${total}`;
        elements.paginationResults.textContent = `Results: ${start}-${end} Of ${total}`;
        elements.previousPage.disabled = state.currentPage <= 1;
        elements.nextPage.disabled = state.currentPage >= totalPages;
    }


    function render() {
        renderTableHeader();
        renderTableBody();
        renderSelection();
        renderPagination();
    }


    function toggleCurrentPage(checked) {
        for (const contact of getCurrentContacts() ) {
            if (checked) {
                state.selectedIds.add(contact.id);
            } else {
                state.selectedIds.delete(contact.id);
            }
        }
        render();
    }

    function selectAllContacts() {
        const allSelected = state.filteredContacts.every((contact) => state.selectedIds.has(contact.id));
        for (const contact of state.filteredContacts) {
            if (allSelected) {
                state.selectedIds.delete(contact.id);
            } else {
                state.selectedIds.add(contact.id);
            }
        }
        render();
    }

    function loadSavedColumns() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
            if (!Array.isArray(saved)) {
                return;
            }
            for (const column of state.columns) {
                if (column.required) {
                    continue;
                }
                column.enabled =saved.includes(column.key);
            }
        } catch {
        }
    }

    function renderColumnsModal() {
        const search = elements.columnSearch.value.trim().toLowerCase();
        const columns = state.columns.filter((column) =>column.label.toLowerCase().includes(search));
        elements.columnsList.innerHTML =
            columns
                .map(
                    (column) => `
                        <label class="columns-list-item">
                            <span>
                                ${escapeHtml(column.label)}
                            </span>
                            <input
                                type="checkbox"
                                data-column="${escapeHtml(column.key)}"
                                ${column.enabled? 'checked': ''}
                                ${column.required ? 'disabled' : ''}
                            >
                        </label>
                    `,
                )
                .join('');
        updateColumnsCount();
    }


    function updateColumnsCount() {
        const enabled = state.columns.filter((column) => column.enabled).length;
        elements.columnsCount.textContent = `${enabled} / ${state.columns.length}`;
    }

    function openColumnsModal() {
        renderColumnsModal();
        elements.columnsModal.classList.remove('hidden');
    }

    function closeColumnsModal() {
        elements.columnsModal.classList.add('hidden');
    }

    function saveColumns() {
        const checked = new Set(Array.from(elements.columnsList.querySelectorAll('[data-column]:checked')).map((checkbox) => checkbox.dataset.column));
        for (const column of state.columns) {
            column.enabled = column.required || checked.has(column.key);
        }

        localStorage.setItem( STORAGE_KEY, JSON.stringify(state.columns.filter((column) => column.enabled).map((column) => column.key)));
        closeColumnsModal();
        render();
    }


    function showContactDetails(contactId) {
        const contact = state.contacts.find((item) => item.id === contactId);
        if (!contact) {
            return;
        }

        const rows = [
            [
                'Name',
                contact.name,
            ],
            [
                'Email',
                contact.email,
            ],
            [
                'Phone',
                contact.phone,
            ],
            [
                'Company',
                contact.company,
            ],
            [
                'City',
                contact.city,
            ],
            [
                'Country',
                contact.country,
            ],
            [
                'Status',
                contact.status,
            ],
            [
                'Channels',
                contact.socialProfiles.join(', ',),
            ],
        ];

        elements.contactDetailsContent
            .innerHTML =
            rows
                .map(
                    ([label, value]) => `
                        <div class="contact-detail-row">
                            <span>
                                ${escapeHtml(label)}
                            </span>
                            <strong>
                                ${escapeHtml(value || '---')}
                            </strong>
                        </div>
                    `,
                )
                .join('');

        elements.contactDetailsModal.classList.remove('hidden');
    }


    function exportContacts() {
        const rows = [
            [
                'Name',
                'Email',
                'Phone',
                'Company',
                'City',
                'Country',
                'Status',
            ],

            ...state.filteredContacts.map(
                (contact) => [
                    contact.name,
                    contact.email,
                    contact.phone,
                    contact.company,
                    contact.city,
                    contact.country,
                    contact.status,
                ],
            ),
        ];

        const csv = rows.map((row) => row.map((value) => `"${String(value ?? '',).replaceAll('"', '""', )}"`,).join(',')).join('\n');
        const blob = new Blob([csv],{type: 'text/csv;charset=utf-8;',},);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement( 'a');
        anchor.href = url;
        anchor.download = 'contacts.csv';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }

    function initializeEvents() {
        elements.search
            .addEventListener(
                'input',
                () => {
                    state.search = elements.search.value;
                    state.currentPage = 1;
                    applyFilters();
                },
            );

        elements.selectAll.addEventListener('click',selectAllContacts);
        elements.previousPage
            .addEventListener(
                'click',
                () => {
                    if (state.currentPage > 1) {
                        state.currentPage--;
                        render();
                    }
                },
            );

        elements.nextPage
            .addEventListener(
                'click',
                () => {
                    if (state.currentPage < getTotalPages() ) {
                        state.currentPage++;
                        render();
                    }
                },
            );

        elements.pageNumber
            .addEventListener(
                'change',
                () => {
                    const requested = Number(elements.pageNumber.value);
                    state.currentPage = Math.min(getTotalPages(), Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
                    render();
                },
            );

        elements.pageSize
            .addEventListener(
                'change',
                () => { 
                    state.pageSize =Number(elements.pageSize.value);
                    state.currentPage = 1;
                    render();
                },
            );

        elements.customizeColumns.addEventListener('click',openColumnsModal);
        elements.closeColumnsModal.addEventListener('click',closeColumnsModal);
        elements.cancelColumns.addEventListener('click',closeColumnsModal);
        elements.saveColumns.addEventListener('click',saveColumns);
        elements.columnSearch.addEventListener('input',renderColumnsModal);

        elements.closeContactDetails
            .addEventListener(
                'click',
                () => {
                    elements.contactDetailsModal.classList.add('hidden');
                },
            );


        elements.exportButton
            .addEventListener(
                'click',
                exportContacts,
            );

        elements.newContactButton
            .addEventListener(
                'click',
                () => {
                    showToast('New Contact form is the next step.');
                },
            );

        elements.columnsModal
            .addEventListener(
                'click',
                (event) => {
                    if (event.target === elements.columnsModal) {
                        closeColumnsModal();
                    }
                },
            );

        elements.contactDetailsModal
            .addEventListener(
                'click',
                (event) => {
                    if (event.target === elements.contactDetailsModal) {
                        elements.contactDetailsModal.classList.add('hidden');
                    }
                },
            );
    }

    async function initialize() {
        loadSavedColumns();
        initializeEvents();
        renderTableHeader();
        await loadContacts();
    }
    initialize();

})();