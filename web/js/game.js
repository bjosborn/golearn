// Regicide Game Logic
class RegicideGame {
    constructor() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.deck = [];
        this.discardPile = [];
        this.enemyDeck = [];
        this.currentEnemy = null;
        this.selectedCards = [];
        this.gameState = 'setup';
        this.init();
    }

    init() {
        this.loadPlayers();
        this.setupEventListeners();
        this.initializeGame();
    }

    loadPlayers() {
        const savedPlayers = localStorage.getItem('regicide_game_players');
        if (savedPlayers) {
            this.players = JSON.parse(savedPlayers).map(p => ({
                ...p,
                hand: [],
                hasYielded: false
            }));
        } else {
            // Default single player for testing
            this.players = [{
                id: 1,
                name: 'Player 1',
                hand: [],
                hasYielded: false
            }];
        }
    }

    setupEventListeners() {
        document.getElementById('back-to-lobby').addEventListener('click', () => {
            if (confirm('Are you sure you want to return to lobby? Game progress will be lost.')) {
                window.location.href = 'index.html';
            }
        });
        document.getElementById('play-cards-btn').addEventListener('click', () => this.playSelectedCards());
        document.getElementById('yield-btn').addEventListener('click', () => this.yieldTurn());
        document.getElementById('discard-btn').addEventListener('click', () => this.discardSelected());
    }

    initializeGame() {
        this.createDeck();
        this.createEnemyDeck();
        this.shuffleDeck();
        this.dealInitialHands();
        this.drawNextEnemy();
        this.updateUI();
        this.gameState = 'playing';
        this.log(`Game started with ${this.players.length} player(s)`);
        this.sendToBackend('game_initialized', { playerCount: this.players.length });
    }

    createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        
        this.deck = [];
        suits.forEach(suit => {
            values.forEach(value => {
                this.deck.push({
                    suit: suit,
                    value: value,
                    numValue: value === 'A' ? 1 : parseInt(value),
                    id: `${value}-${suit}`
                });
            });
        });
    }

    createEnemyDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const faces = [
            { name: 'J', health: 10, attack: 10 },
            { name: 'Q', health: 15, attack: 15 },
            { name: 'K', health: 20, attack: 20 }
        ];

        this.enemyDeck = [];
        suits.forEach(suit => {
            faces.forEach(face => {
                this.enemyDeck.push({
                    suit: suit,
                    value: face.name,
                    health: face.health,
                    maxHealth: face.health,
                    attack: face.attack,
                    id: `${face.name}-${suit}`
                });
            });
        });
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealInitialHands() {
        const cardsPerPlayer = this.players.length === 1 ? 8 : 
                               this.players.length === 2 ? 7 : 
                               this.players.length === 3 ? 6 : 5;

        this.players.forEach(player => {
            player.hand = [];
            for (let i = 0; i < cardsPerPlayer; i++) {
                if (this.deck.length > 0) {
                    player.hand.push(this.deck.pop());
                }
            }
        });
    }

    drawNextEnemy() {
        if (this.enemyDeck.length > 0) {
            this.currentEnemy = this.enemyDeck.pop();
            this.log(`A wild ${this.currentEnemy.value} of ${this.currentEnemy.suit} appears!`);
            this.sendToBackend('enemy_drawn', this.currentEnemy);
        } else {
            this.gameState = 'won';
            this.log('Victory! All enemies defeated!');
            this.sendToBackend('game_won', {});
            alert('Congratulations! You have defeated all the enemies and won Regicide!');
        }
    }

    playSelectedCards() {
        if (this.selectedCards.length === 0) {
            alert('Select at least one card to play');
            return;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        const totalDamage = this.selectedCards.reduce((sum, card) => sum + card.numValue, 0);
        
        // Apply damage to enemy
        this.currentEnemy.health -= totalDamage;
        this.log(`${currentPlayer.name} plays ${this.selectedCards.length} card(s) for ${totalDamage} damage`);
        
        // Move cards to discard
        this.selectedCards.forEach(card => {
            const index = currentPlayer.hand.findIndex(c => c.id === card.id);
            if (index > -1) {
                currentPlayer.hand.splice(index, 1);
                this.discardPile.push(card);
            }
        });
        
        this.selectedCards = [];
        this.sendToBackend('cards_played', { 
            player: currentPlayer.name, 
            damage: totalDamage,
            enemyHealth: this.currentEnemy.health 
        });

        // Check if enemy is defeated
        if (this.currentEnemy.health <= 0) {
            this.log(`${this.currentEnemy.value} of ${this.currentEnemy.suit} defeated!`);
            this.sendToBackend('enemy_defeated', this.currentEnemy);
            this.drawNextEnemy();
        } else {
            // Enemy attacks back (simplified)
            const damage = Math.min(this.currentEnemy.attack, currentPlayer.hand.length);
            if (damage > 0) {
                for (let i = 0; i < damage && currentPlayer.hand.length > 0; i++) {
                    const card = currentPlayer.hand.pop();
                    this.discardPile.push(card);
                }
                this.log(`Enemy attacks! ${currentPlayer.name} discards ${damage} card(s)`);
            }
        }

        this.nextTurn();
        this.updateUI();
    }

    yieldTurn() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        currentPlayer.hasYielded = true;
        this.log(`${currentPlayer.name} yields their turn`);
        this.sendToBackend('turn_yielded', { player: currentPlayer.name });
        this.nextTurn();
        this.updateUI();
    }

    discardSelected() {
        if (this.selectedCards.length === 0) {
            alert('Select at least one card to discard');
            return;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        this.selectedCards.forEach(card => {
            const index = currentPlayer.hand.findIndex(c => c.id === card.id);
            if (index > -1) {
                currentPlayer.hand.splice(index, 1);
                this.discardPile.push(card);
            }
        });

        this.log(`${currentPlayer.name} discards ${this.selectedCards.length} card(s)`);
        this.selectedCards = [];
        this.sendToBackend('cards_discarded', { player: currentPlayer.name });
        this.updateUI();
    }

    nextTurn() {
        // Reset yield status
        this.players[this.currentPlayerIndex].hasYielded = false;
        
        // Move to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        // Draw a card for the new current player
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (this.deck.length > 0) {
            currentPlayer.hand.push(this.deck.pop());
        }

        this.log(`${currentPlayer.name}'s turn`);
    }

    renderCard(card, container, selectable = false) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${card.suit} dealing`;
        cardDiv.innerHTML = `
            <div class="card-value">${card.value}</div>
            <div class="card-suit">${this.getSuitSymbol(card.suit)}</div>
        `;

        if (selectable) {
            cardDiv.addEventListener('click', () => this.toggleCardSelection(card, cardDiv));
        }

        container.appendChild(cardDiv);
    }

    toggleCardSelection(card, cardDiv) {
        const index = this.selectedCards.findIndex(c => c.id === card.id);
        
        if (index > -1) {
            this.selectedCards.splice(index, 1);
            cardDiv.classList.remove('selected');
        } else {
            this.selectedCards.push(card);
            cardDiv.classList.add('selected');
        }

        document.getElementById('play-cards-btn').disabled = this.selectedCards.length === 0;
        document.getElementById('discard-btn').disabled = this.selectedCards.length === 0;
    }

    getSuitSymbol(suit) {
        const symbols = {
            hearts: '♥',
            diamonds: '♦',
            clubs: '♣',
            spades: '♠'
        };
        return symbols[suit] || suit;
    }

    updateUI() {
        // Update enemy
        if (this.currentEnemy) {
            const enemyCard = document.querySelector('#current-enemy .card');
            enemyCard.className = `card enemy-card ${this.currentEnemy.suit} face`;
            enemyCard.innerHTML = `
                <div class="card-value">${this.currentEnemy.value}</div>
                <div class="card-suit">${this.getSuitSymbol(this.currentEnemy.suit)}</div>
            `;
            document.getElementById('enemy-health').textContent = this.currentEnemy.health;
            document.getElementById('enemy-attack').textContent = this.currentEnemy.attack;
        }

        // Update deck counts
        document.getElementById('deck-count').textContent = this.deck.length;
        document.getElementById('discard-count').textContent = this.discardPile.length;
        document.getElementById('enemy-deck-count').textContent = this.enemyDeck.length;

        // Update players
        const playersArea = document.getElementById('players-area');
        playersArea.innerHTML = '';
        this.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = `player-info ${index === this.currentPlayerIndex ? 'active' : ''}`;
            playerDiv.innerHTML = `
                <h4>${player.name}</h4>
                <p>Cards: ${player.hand.length}</p>
            `;
            playersArea.appendChild(playerDiv);
        });

        // Update current player's hand
        const currentPlayer = this.players[this.currentPlayerIndex];
        const handArea = document.getElementById('player-hand');
        handArea.innerHTML = '';
        currentPlayer.hand.forEach(card => {
            this.renderCard(card, handArea, true);
        });

        // Update game status
        document.getElementById('current-turn-player').textContent = currentPlayer.name;
        document.getElementById('game-status').textContent = this.gameState;
    }

    log(message) {
        const activityFeed = document.getElementById('game-activity');
        const timestamp = new Date().toLocaleTimeString();
        
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `${message}<span class="timestamp">${timestamp}</span>`;
        
        activityFeed.insertBefore(item, activityFeed.firstChild);

        // Keep only last 30 items
        while (activityFeed.children.length > 30) {
            activityFeed.removeChild(activityFeed.lastChild);
        }
    }

    sendToBackend(eventType, data) {
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
        });
    }
}

// Initialize game
const game = new RegicideGame();
