document.addEventListener('DOMContentLoaded', () => {
    const itemsList = document.getElementById('items-list');
    const addItemForm = document.getElementById('add-item-form');
    const nameInput = document.getElementById('item-name');
    const quantityInput = document.getElementById('item-quantity');
    const brandSelect = document.getElementById('item-brand');
    const locationSelect = document.getElementById('item-location');
    const packageSizeInput = document.getElementById('item-package-size');
    const packageUnitSelect = document.getElementById('item-package-unit');
    const loadingEl = document.getElementById('loading');
    const searchInput = document.getElementById('search-input');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-modal');
    const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
    const editItemForm = document.getElementById('edit-item-form-modal');
    const editNameInput = document.getElementById('edit-item-name');
    const editBrandSelect = document.getElementById('edit-item-brand');
    const editLocationSelect = document.getElementById('edit-item-location');
    const editPackageSizeInput = document.getElementById('edit-item-package-size');
    const editPackageUnitSelect = document.getElementById('edit-item-package-unit');
    let currentEditingItemId = null;

    // Locations Modal Elements
    const manageLocationsBtn = document.getElementById('manage-locations-btn');
    const locationsModal = document.getElementById('locations-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addLocationForm = document.getElementById('add-location-form');
    const locationNameInput = document.getElementById('location-name');
    const locationsListEl = document.getElementById('locations-list');

    // API endpoints
    const API_BASE = 'api/items';
    const LOCATIONS_API = 'api/locations';
    const BRANDS_API = 'api/brands';

    // State
    let items = [];
    let locations = [];

    // Setup Modal
    manageLocationsBtn.addEventListener('click', () => {
        locationsModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => {
        locationsModal.classList.add('hidden');
    });

    // Close modal on background click
    locationsModal.addEventListener('click', (e) => {
        if (e.target === locationsModal) {
            locationsModal.classList.add('hidden');
        }
    });

    closeEditModalBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.classList.add('hidden');
        }
    });

    const fetchLocations = async () => {
        try {
            const res = await fetch(LOCATIONS_API);
            if (!res.ok) throw new Error('Failed to fetch locations');
            const data = await res.json();
            locations = data.locations;
            renderLocations();
            updateLocationSelect();
        } catch (error) {
            console.error(error);
        }
    };

    const fetchBrands = async () => {
        try {
            const res = await fetch(BRANDS_API);
            if (!res.ok) throw new Error('Failed to fetch brands');
            const data = await res.json();
            const currentVal = brandSelect.value;
            brandSelect.innerHTML = '<option value="">No Brand</option>';
            data.brands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                opt.textContent = b;
                brandSelect.appendChild(opt);
            });
            const newOpt = document.createElement('option');
            newOpt.value = '__NEW__';
            newOpt.textContent = '+ Add New...';
            brandSelect.appendChild(newOpt);

            if (currentVal && currentVal !== '__NEW__' && data.brands.includes(currentVal)) {
                brandSelect.value = currentVal;
            } else if (currentVal && currentVal !== '__NEW__' && !data.brands.includes(currentVal)) {
                const opt = document.createElement('option');
                opt.value = currentVal;
                opt.textContent = currentVal;
                brandSelect.insertBefore(opt, brandSelect.lastElementChild);
                brandSelect.value = currentVal;
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (brandSelect) {
        brandSelect.addEventListener('change', (e) => {
            if (e.target.value === '__NEW__') {
                const newBrand = prompt('Enter new brand name:');
                if (newBrand && newBrand.trim() !== '') {
                    const val = newBrand.trim();
                    let exists = Array.from(brandSelect.options).some(o => o.value === val);
                    if (!exists) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        brandSelect.insertBefore(opt, brandSelect.lastElementChild);
                    }
                    brandSelect.value = val;
                } else {
                    brandSelect.value = '';
                }
            }
        });
    }

    const fetchItems = async () => {
        try {
            const res = await fetch(API_BASE);
            if (!res.ok) throw new Error('Failed to fetch items');
            const data = await res.json();
            items = data.items;
            renderItems();
        } catch (error) {
            console.error(error);
            loadingEl.textContent = 'Error loading items. Please check your connection.';
            loadingEl.style.color = '#ef4444';
        }
    };

    const updateLocationSelect = () => {
        // preserve current selection
        const currentVal = locationSelect.value;
        const currentEditVal = editLocationSelect.value;

        const optionsHTML = '<option value="">Unassigned Location</option>' +
            locations.map(loc => `<option value="${loc.id}">${escapeHTML(loc.name)}</option>`).join('');

        locationSelect.innerHTML = optionsHTML;
        editLocationSelect.innerHTML = optionsHTML;

        if (currentVal) locationSelect.value = currentVal;
        if (currentEditVal) editLocationSelect.value = currentEditVal;
    };

    const renderLocations = () => {
        locationsListEl.innerHTML = '';
        locations.forEach(loc => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${escapeHTML(loc.name)}</span>
                <button class="delete-btn" data-id="${loc.id}" aria-label="Delete location">&times;</button>
            `;
            li.querySelector('.delete-btn').addEventListener('click', () => deleteLocation(loc.id));
            locationsListEl.appendChild(li);
        });
    };

    addLocationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = locationNameInput.value.trim();
        if (!name) return;
        try {
            const res = await fetch(LOCATIONS_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (!res.ok) throw new Error('Failed to add location');
            locationNameInput.value = '';
            await fetchLocations();
        } catch (error) {
            console.error(error);
            alert('Failed to add location. It might already exist.');
        }
    });

    const deleteLocation = async (id) => {
        if (!confirm('Are you sure you want to delete this location? Items in it will become unassigned.')) return;
        try {
            const res = await fetch(`${LOCATIONS_API}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete location');
            await fetchLocations();
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert('Failed to delete location');
        }
    };

    searchInput.addEventListener('input', () => {
        renderItems();
    });

    const renderItems = () => {
        itemsList.innerHTML = '';
        if (items.length === 0) {
            loadingEl.textContent = 'No items in storage. Add some above!';
            loadingEl.classList.remove('hidden');
            return;
        }
        loadingEl.classList.add('hidden');

        const query = searchInput.value.trim().toLowerCase();

        if (query) {
            // Search Mode: Flat Table
            let filteredItems = items.filter(i => {
                const nameMatch = i.name.toLowerCase().includes(query);
                const brandMatch = i.brand && i.brand.toLowerCase().includes(query);
                return nameMatch || brandMatch;
            });

            filteredItems.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aBrand = (a.brand || '').toLowerCase();
                const bBrand = (b.brand || '').toLowerCase();

                const aNameIndex = aName.indexOf(query);
                const bNameIndex = bName.indexOf(query);
                const aBrandIndex = aBrand.indexOf(query);
                const bBrandIndex = bBrand.indexOf(query);

                // Get the best index (lowest non-negative) for each
                const getBestIndex = (ni, bi) => {
                    if (ni === -1) return bi;
                    if (bi === -1) return ni;
                    return Math.min(ni, bi);
                };

                const aIndex = getBestIndex(aNameIndex, aBrandIndex);
                const bIndex = getBestIndex(bNameIndex, bBrandIndex);

                if (aIndex === bIndex) {
                    return aName.localeCompare(bName);
                }
                return aIndex - bIndex;
            });

            if (filteredItems.length === 0) {
                itemsList.innerHTML = '<div class="loading">No items found matching your search.</div>';
                return;
            }

            const table = document.createElement('table');
            table.className = 'search-results-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Location</th>
                        <th>Quantity</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;
            const tbody = table.querySelector('tbody');

            filteredItems.forEach(item => {
                const tr = document.createElement('tr');
                tr.className = item.quantity === 0 ? 'zero-quantity' : '';

                const locName = item.location_name ? item.location_name : 'Unassigned';
                const pkgInfo = item.package_size ? ` (${item.package_size}${item.package_unit || ''})` : '';
                const brandInfo = item.brand ? ` <span style="font-size:0.9rem; color:var(--text-muted); margin-left: 0.5rem; padding: 0.1rem 0.4rem; background: rgba(255,255,255,0.1); border-radius: 4px;">${escapeHTML(item.brand)}</span>` : '';

                tr.innerHTML = `
                    <td style="font-weight: 600;">${escapeHTML(item.name)}${escapeHTML(pkgInfo)}${brandInfo}</td>
                    <td style="color: var(--text-muted);">${escapeHTML(locName)}</td>
                    <td style="font-weight: 700;">${item.quantity}</td>
                    <td class="actions-cell">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <div class="item-controls" style="background: transparent; border: none; padding: 0;">
                                <button class="qty-btn btn-minus" aria-label="Decrease quantity" style="background: rgba(15,23,42,0.5);">-</button>
                                <button class="qty-btn btn-plus" aria-label="Increase quantity" style="background: rgba(15,23,42,0.5);">+</button>
                            </div>
                            <div class="item-actions">
                                <button class="action-btn edit" title="Edit item">✏️</button>
                                <button class="action-btn delete" title="Delete item">🗑️</button>
                            </div>
                        </div>
                    </td>
                `;

                tr.querySelector('.btn-minus').addEventListener('click', () => updateQuantity(item.id, Math.max(0, item.quantity - 1)));
                tr.querySelector('.btn-plus').addEventListener('click', () => updateQuantity(item.id, item.quantity + 1));
                tr.querySelector('.edit').addEventListener('click', () => openEditModal(item));
                tr.querySelector('.delete').addEventListener('click', () => deleteItem(item.id));

                tbody.appendChild(tr);
            });

            itemsList.appendChild(table);

        } else {
            // Normal Grouped Mode
            const grouped = { 'null': [] };
            locations.forEach(loc => grouped[loc.id] = []);
            items.forEach(item => {
                const locId = item.location_id || 'null';
                if (grouped[locId]) {
                    grouped[locId].push(item);
                } else {
                    grouped['null'].push(item);
                }
            });

            const createGrid = (itemsArray) => {
                const grid = document.createElement('div');
                grid.className = 'items-grid';
                itemsArray.forEach(item => {
                    const card = document.createElement('div');
                    card.className = `item-card ${item.quantity === 0 ? 'zero-quantity' : ''}`;
                    card.dataset.id = item.id;

                    const pkgInfo = item.package_size ? ` <span style="font-size:0.9rem; color:var(--text-muted);">(${item.package_size}${escapeHTML(item.package_unit || '')})</span>` : '';
                    const brandInfo = item.brand ? ` <div style="font-size:0.85rem; color:var(--primary-color); margin-top: -0.5rem; margin-bottom: 0.5rem;">${escapeHTML(item.brand)}</div>` : '';
                    card.innerHTML = `
                        <div class="item-header">
                            <div class="item-name">${escapeHTML(item.name)}${pkgInfo}</div>
                            <div class="item-actions">
                                <button class="action-btn edit" title="Edit item">✏️</button>
                                <button class="action-btn delete" title="Delete item">🗑️</button>
                            </div>
                        </div>
                        ${brandInfo}
                        <div class="item-controls">
                            <button class="qty-btn btn-minus" aria-label="Decrease quantity">-</button>
                            <div class="item-quantity">${item.quantity}</div>
                            <button class="qty-btn btn-plus" aria-label="Increase quantity">+</button>
                        </div>
                    `;

                    const btnMinus = card.querySelector('.btn-minus');
                    const btnPlus = card.querySelector('.btn-plus');
                    const btnEdit = card.querySelector('.edit');
                    const btnDelete = card.querySelector('.delete');

                    btnMinus.addEventListener('click', () => updateQuantity(item.id, Math.max(0, item.quantity - 1)));
                    btnPlus.addEventListener('click', () => updateQuantity(item.id, item.quantity + 1));
                    btnEdit.addEventListener('click', () => openEditModal(item));
                    btnDelete.addEventListener('click', () => deleteItem(item.id));

                    grid.appendChild(card);
                });
                return grid;
            };

            locations.forEach(loc => {
                const locItems = grouped[loc.id];
                if (locItems && locItems.length > 0) {
                    const details = document.createElement('details');
                    details.open = true;
                    details.innerHTML = `<summary>${escapeHTML(loc.name)} <span class="loc-count">(${locItems.length})</span></summary><div class="details-content"></div>`;
                    details.querySelector('.details-content').appendChild(createGrid(locItems));
                    itemsList.appendChild(details);
                }
            });

            if (grouped['null'].length > 0) {
                const details = document.createElement('details');
                details.open = true;
                details.innerHTML = `<summary>Unassigned <span class="loc-count">(${grouped['null'].length})</span></summary><div class="details-content"></div>`;
                details.querySelector('.details-content').appendChild(createGrid(grouped['null']));
                itemsList.appendChild(details);
            }
        }
    };

    // Add new item
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const quantity = parseInt(quantityInput.value, 10);
        const location_id = locationSelect.value || null;
        const package_size = packageSizeInput.value ? parseFloat(packageSizeInput.value) : null;
        const package_unit = packageUnitSelect.value || null;
        const brand = (brandSelect.value && brandSelect.value !== '__NEW__') ? brandSelect.value.trim() : null;

        if (!name) return;

        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, quantity, location_id, package_size, package_unit, brand })
            });
            if (!res.ok) throw new Error('Failed to add item');

            nameInput.value = '';
            brandSelect.value = '';
            quantityInput.value = '1';
            packageSizeInput.value = '';
            packageUnitSelect.value = '';
            nameInput.focus();

            await fetchBrands();
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert('Failed to add item');
        }
    });

    const openEditModal = (item) => {
        currentEditingItemId = item.id;
        editNameInput.value = item.name;

        // Populate brand select and select current brand
        const brands = Array.from(brandSelect.options)
            .map(o => o.value)
            .filter(v => v !== '__NEW__' && v !== '');

        editBrandSelect.innerHTML = '<option value="">No Brand</option>' +
            brands.map(b => `<option value="${b}">${escapeHTML(b)}</option>`).join('');

        if (item.brand) {
            // Check if brand is in current list, if not add it temporarily
            if (!brands.includes(item.brand)) {
                const opt = document.createElement('option');
                opt.value = item.brand;
                opt.textContent = item.brand;
                editBrandSelect.appendChild(opt);
            }
            editBrandSelect.value = item.brand;
        } else {
            editBrandSelect.value = '';
        }

        editLocationSelect.value = item.location_id || '';
        editPackageSizeInput.value = item.package_size || '';
        editPackageUnitSelect.value = item.package_unit || '';

        editModal.classList.remove('hidden');
    };

    editItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentEditingItemId) return;

        const name = editNameInput.value.trim();
        const brand = editBrandSelect.value || null;
        const location_id = editLocationSelect.value || null;
        const package_size = editPackageSizeInput.value ? parseFloat(editPackageSizeInput.value) : null;
        const package_unit = editPackageUnitSelect.value || null;

        if (!name) return;

        try {
            const res = await fetch(`${API_BASE}/${currentEditingItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, brand, location_id, package_size, package_unit })
            });

            if (!res.ok) throw new Error('Failed to update item');

            editModal.classList.add('hidden');
            await fetchItems();
            await fetchBrands();
        } catch (error) {
            console.error(error);
            alert('Failed to update item');
        }
    });

    const updateQuantity = async (id, newQuantity) => {
        const itemIndex = items.findIndex(i => i.id === id);
        if (itemIndex > -1) {
            items[itemIndex].quantity = newQuantity;
            renderItems();
        }

        try {
            const res = await fetch(`${API_BASE}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: newQuantity })
            });
            if (!res.ok) throw new Error('Failed to update quantity');
        } catch (error) {
            console.error(error);
            alert('Failed to update item quantity');
            // Revert state if failed
            await fetchItems();
        }
    };

    const deleteItem = async (id) => {
        if (!confirm('Are you sure you want to remove this item?')) return;

        try {
            const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete item');
            await fetchItems();
        } catch (error) {
            console.error(error);
            alert('Failed to delete item');
        }
    };

    const escapeHTML = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    // Initialization
    const init = async () => {
        await fetchLocations();
        await fetchBrands();
        await fetchItems();
    };

    init();
});
