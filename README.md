# Home Inventory - Home Assistant Add-on

Track your supplies easily with this Home Assistant Add-on. Keep track of what you have in your cellar, pantry, or fridge.

## Features
- **Create Items**: Add new items like "Wine", "Apples", or "Flour" and specify their quantity.
- **Set Quantity**: Use the intuitive `+` and `-` buttons to adjust the quantity of any item.
- **Zero Quantity Handling**: When an item reaches a quantity of 0, its card becomes grayed out but remains available so you know you're out of stock and can easily restock it later by clicking `+`.
- **Delete Items**: Remove items you no longer want to track.
- **Alphabetical Sorting**: Items are sorted alphabetically by name for easy search and discovery.

## Installation

### Method 1: GitHub Repository (Recommended)

1. In your Home Assistant frontend, navigate to **Settings** -> **Add-ons** -> **Add-on Store**.
2. Click the 3 vertical dots in the top right corner and select **Repositories**.
3. Add this URL to your Home Assistant: `https://github.com/matthiashamacher/home-inventory`
4. Click **Add** and close the dialog.
5. The "Home Inventory" add-on will now appear in the Add-on Store (you might need to refresh the page or click "Check for updates" in the 3-dots menu).
6. Click on it and then click **Install**.

### Method 2: Local Installation

1. Make sure you have access to your Home Assistant folders (e.g., via Samba Share or SSH).
2. Inside the `addons` directory, create a folder named `home-inventory`.
3. Copy all files from this project into that new folder.
4. Go to **Settings** -> **Add-ons** -> **Add-on Store** in Home Assistant.
5. Click the 3 dots in the top right corner and select **Check for updates**.
6. The Add-on should appear under "Local add-ons".
7. Click on it and select **Install**.

## Usage
- After installation, enable **Show in sidebar** and click **Start**.
- You can now access your Home Inventory tracking right from your Home Assistant sidebar!
