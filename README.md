# Iron Dune: Operations

**Iron Dune: Operations** is a browser-based real-time strategy game where you build an empire, manage resources, and command armies in tactical warfare.

![Iron Dune Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## 🎮 Game Mechanics

### Core Engine
- **Tick Rate:** The game updates every second.
- **Offline Simulation:** Production, construction, and battles continue even when you are offline. When you return, the game calculates what happened while you were away.

### Economy
- **Dynamic Storage:** Resource capacity scales with your Empire Points and Tech level.
- **Banking:** Earn interest on your cash reserves.
- **Global Market:** Buy and sell resources (Oil, Ammo, Gold, Diamond) with dynamic prices affected by global events.

### Infrastructure
- **Construction:** Build and upgrade structures like Refineries, Barracks, and Labs.
- **Modes:**
    - *Quantity*: Build multiple instances (e.g., Houses).
    - *Level*: Upgrade single instances (e.g., Bank).

### Military & Combat
- **Units:** Command 15+ unit types across 5 categories (Infantry, Tanks, Artillery, Air, Naval).
- **Combat System:** Rock-Paper-Scissors mechanics with detailed damage calculations.
- **Threat System:** Aggressive actions generate Threat, which can trigger enemy attacks.

### Game Modes
- **Campaign:** 25 progressive PvE levels with unique challenges.
- **PvP:** Attack other players (simulated bots) to loot resources.
- **Patrols:** Send units on patrol missions for low-risk rewards.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/iron-dune-operations.git
    cd iron-dune-operations
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start Development Server:**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173`.

4.  **Build for Production:**
    ```bash
    npm run build
    ```
    The optimized files will be generated in the `dist/` folder.

## ☁️ Deployment

### Vercel
1.  Push your code to GitHub/GitLab/Bitbucket.
2.  Import the project into [Vercel](https://vercel.com).
3.  Vercel will automatically detect the Vite framework settings.
    - **Build Command:** `npm run build`
    - **Output Directory:** `dist`
4.  Click **Deploy**.

   *A `vercel.json` file is included to handle client-side routing.*

### Netlify
1.  Push your code to a Git provider.
2.  Import the project into [Netlify](https://netlify.com).
3.  Netlify will automatically detect the settings from `netlify.toml`.
    - **Build Command:** `npm run build`
    - **Publish Directory:** `dist`
4.  Click **Deploy**.

---

*Powered by React, Vite, and TypeScript.*
