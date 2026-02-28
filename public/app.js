document.addEventListener('DOMContentLoaded', () => {
    const itemsList = document.getElementById('items-list');
    const addItemForm = document.getElementById('add-item-form');
    const nameInput = document.getElementById('item-name');
    const quantityInput = document.getElementById('item-quantity');
    const locationSelect = document.getElementById('item-location');
    const loadingEl = document.getElementById('loading');
    const searchInput = document.getElementById('search-input');

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
        locationSelect.innerHTML = '<option value="">Unassigned Location</option>';
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc.id;
            opt.textContent = escapeHTML(loc.name);
            locationSelect.appendChild(opt);
        });
        if (currentVal) locationSelect.value = currentVal;
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
            let filteredItems = items.filter(i => i.name.toLowerCase().includes(query));
            filteredItems.sort((a, b) => {
                const aName = a.name.toLowerCase();
                const bName = b.name.toLowerCase();
                const aIndex = aName.indexOf(query);
                const bIndex = bName.indexOf(query);
                if (aIndex === bIndex) return aName.localeCompare(bName);
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

                tr.innerHTML = `
                    <td style="font-weight: 600;">${escapeHTML(item.name)}</td>
                    <td style="color: var(--text-muted);">${escapeHTML(locName)}</td>
                    <td style="font-weight: 700;">${item.quantity}</td>
                    <td class="actions-cell">
                        <div class="item-controls" style="background: transparent; border: none; padding: 0;">
                            <button class="qty-btn btn-minus" aria-label="Decrease quantity" style="background: rgba(15,23,42,0.5);">-</button>
                            <button class="qty-btn btn-plus" aria-label="Increase quantity" style="background: rgba(15,23,42,0.5);">+</button>
                            <button class="delete-btn" aria-label="Delete item" style="margin-left: 0.5rem; background: rgba(15,23,42,0.5);">&times;</button>
                        </div>
                    </td>
                `;

                tr.querySelector('.btn-minus').addEventListener('click', () => updateQuantity(item.id, Math.max(0, item.quantity - 1)));
                tr.querySelector('.btn-plus').addEventListener('click', () => updateQuantity(item.id, item.quantity + 1));
                tr.querySelector('.delete-btn').addEventListener('click', () => deleteItem(item.id));

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

                    card.innerHTML = `
                        <div class="item-header">
                            <div class="item-name">${escapeHTML(item.name)}</div>
                            <button class="delete-btn" aria-label="Delete item">&times;</button>
                        </div>
                        <div class="item-controls">
                            <button class="qty-btn btn-minus" aria-label="Decrease quantity">-</button>
                            <div class="item-quantity">${item.quantity}</div>
                            <button class="qty-btn btn-plus" aria-label="Increase quantity">+</button>
                        </div>
                    `;

                    const btnMinus = card.querySelector('.btn-minus');
                    const btnPlus = card.querySelector('.btn-plus');
                    const btnDelete = card.querySelector('.delete-btn');

                    btnMinus.addEventListener('click', () => updateQuantity(item.id, Math.max(0, item.quantity - 1)));
                    btnPlus.addEventListener('click', () => updateQuantity(item.id, item.quantity + 1));
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

        if (!name) return;

        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, quantity, location_id })
            });
            if (!res.ok) throw new Error('Failed to add item');

            nameInput.value = '';
            quantityInput.value = '1';
            nameInput.focus();

            await fetchItems();
        } catch (error) {
            console.error(error);
            alert('Failed to add item');
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
        await fetchItems();
    };

    init();
});
