// Lobby management
class Lobby {
    constructor() {
        this.players = [];
        this.maxPlayers = 4;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFromStorage();
        this.updateUI();
    }

    setupEventListeners() {
        document.getElementById('add-player-btn').addEventListener('click', () => this.addPlayer());
        document.getElementById('player-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPlayer();
        });
        document.getElementById('start-game-btn').addEventListener('click', () => this.startGame());
        document.getElementById('clear-lobby-btn').addEventListener('click', () => this.clearLobby());
    }

    addPlayer() {
        const nameInput = document.getElementById('player-name');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a player name');
            return;
        }

        if (this.players.length >= this.maxPlayers) {
            alert('Lobby is full! Maximum 4 players.');
            return;
        }

        if (this.players.some(p => p.name === name)) {
            alert('Player name already exists!');
            return;
        }

        const player = {
            id: Date.now(),
            name: name,
            joinedAt: new Date().toISOString()
        };

        this.players.push(player);
        nameInput.value = '';
        this.saveToStorage();
        this.updateUI();
        this.logActivity(`Player "${name}" joined the lobby`);
        
        // Send to backend
        this.sendToBackend('player_joined', player);
    }

    removePlayer(playerId) {
        const player = this.players.find(p => p.id === playerId);
        if (player) {
            this.players = this.players.filter(p => p.id !== playerId);
            this.saveToStorage();
            this.updateUI();
            this.logActivity(`Player "${player.name}" left the lobby`);
            this.sendToBackend('player_left', { playerId, name: player.name });
        }
    }

    clearLobby() {
        if (this.players.length === 0) return;
        
        if (confirm('Are you sure you want to clear the lobby?')) {
            this.logActivity('Lobby cleared');
            this.players = [];
            this.saveToStorage();
            this.updateUI();
            this.sendToBackend('lobby_cleared', {});
        }
    }

    startGame() {
        if (this.players.length < 1) {
            alert('Need at least 1 player to start!');
            return;
        }

        this.logActivity(`Game started with ${this.players.length} player(s)`);
        this.sendToBackend('game_started', { players: this.players });
        
        // Save game state and redirect
        localStorage.setItem('regicide_game_players', JSON.stringify(this.players));
        window.location.href = 'game.html';
    }

    updateUI() {
        const playersList = document.getElementById('players-ul');
        const playerCount = document.getElementById('player-count');
        const startBtn = document.getElementById('start-game-btn');

        playerCount.textContent = this.players.length;
        playersList.innerHTML = '';

        this.players.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${player.name}</span>
                <button class="remove-player-btn" onclick="lobby.removePlayer(${player.id})">✕</button>
            `;
            playersList.appendChild(li);
        });

        startBtn.disabled = this.players.length < 1;
    }

    logActivity(message) {
        const activityFeed = document.getElementById('activity-feed');
        const timestamp = new Date().toLocaleTimeString();
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `${message}<span class="timestamp">${timestamp}</span>`;
        
        activityFeed.insertBefore(item, activityFeed.firstChild);

        // Keep only last 20 items
        while (activityFeed.children.length > 20) {
            activityFeed.removeChild(activityFeed.lastChild);
        }

        // Send to backend
        this.sendToBackend('activity_log', { message, timestamp });
    }

    saveToStorage() {
        localStorage.setItem('regicide_lobby', JSON.stringify(this.players));
    }

    loadFromStorage() {
        const saved = localStorage.getItem('regicide_lobby');
        if (saved) {
            try {
                this.players = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading lobby data:', e);
                this.players = [];
            }
        }
    }

    sendToBackend(eventType, data) {
        // Send activity to backend API
        fetch('/api/activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                event_type: eventType,
                data: data,
                timestamp: new Date().toISOString()
            })
        }).catch(err => {
            console.log('Backend not available:', err);
            // Continue working offline
        });
    }
}

// Initialize lobby
const lobby = new Lobby();
