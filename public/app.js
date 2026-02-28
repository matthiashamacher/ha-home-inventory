document.addEventListener('DOMContentLoaded', () => {
    const itemsList = document.getElementById('items-list');
    const addItemForm = document.getElementById('add-item-form');
    const nameInput = document.getElementById('item-name');
    const quantityInput = document.getElementById('item-quantity');
    const loadingEl = document.getElementById('loading');

    // API endpoint relative to current location
    const API_BASE = 'api/items';

    // State
    let items = [];

    // Fetch items from server
    const fetchItems = async () => {
        try {
            // Using relative path handles ingress cases in Home Assistant since the add-on runs under a subpath
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

    // Render items to DOM
    const renderItems = () => {
        itemsList.innerHTML = '';
        if (items.length === 0) {
            loadingEl.textContent = 'No items in storage. Add some above!';
            loadingEl.classList.remove('hidden');
            return;
        }

        loadingEl.classList.add('hidden');

        items.forEach(item => {
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

            itemsList.appendChild(card);
        });
    };

    // Add new item
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        const quantity = parseInt(quantityInput.value, 10);

        if (!name) return;

        try {
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, quantity })
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

    fetchItems();
});
